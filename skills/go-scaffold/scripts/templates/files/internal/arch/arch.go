// Package arch turns the module boundary from a convention into a test.
//
// A directory layout that nothing enforces decays. The first cross-module
// shortcut compiles, reads as "just one import" in review, and a few of those
// later the modular monolith is a flat application with extra folders. Check
// reads every import under internal/ and reports the ones that cross a line the
// architecture forbids; arch_test.go fails the build on any of them.
//
// It parses source directly (go/parser in ImportsOnly mode) rather than loading
// packages through the toolchain. That needs nothing but the files on disk,
// adds no dependency to the module, and — unlike a type-checked load — also
// sees files excluded by a build tag, which is exactly where an illegal import
// would survive unnoticed.
package arch

import (
	"fmt"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Violation is one illegal import, reported with enough context to fix it
// without going and reading this file.
type Violation struct {
	File   string // repo-relative, slash-separated
	Import string // the offending import path, repo-relative where internal
	Rule   string
	Why    string
}

func (v Violation) String() string {
	return fmt.Sprintf("%s\n    imports: %s\n    rule:    %s\n    why:     %s", v.File, v.Import, v.Rule, v.Why)
}

// rule is a layering constraint: packages matching any From pattern may not
// import anything matching a Deny pattern.
//
// Patterns are slash-separated and match repo-relative package paths (for this
// module's own packages) or full import paths (for third-party ones). "*"
// matches exactly one path segment; "**" matches any number of trailing
// segments and may only appear last.
type rule struct {
	Name string
	From []string
	Deny []string
	Why  string
}

// rules are the layering constraints. The cross-module encapsulation rule is
// not here — it needs to compare the importing and imported module identities,
// which a static pattern cannot express; see checkEncapsulation.
var rules = []rule{
	{
		Name: "domain is the innermost layer",
		From: []string{"internal/modules/*/domain/**"},
		Deny: []string{
			"internal/modules/*/application/**",
			"internal/modules/*/infrastructure/**",
			"internal/modules/*/api/**",
			"internal/api/**",
			"internal/openapi/**",
		},
		Why: "entities and their invariants must not know about use cases, storage, or transport — that knowledge is what makes rules untestable and unmovable",
	},
	{
		Name: "application depends on ports, not on their implementations",
		From: []string{"internal/modules/*/application/**"},
		Deny: []string{
			"internal/modules/*/infrastructure/**",
			"internal/modules/*/api/**",
			"internal/api/**",
			"internal/openapi/**",
		},
		Why: "a use case that imports the repository cannot be tested without a database; declare a port in the application package and let infrastructure implement it",
	},
	{
		Name: "domain and application stay framework-free",
		From: []string{
			"internal/modules/*/domain/**",
			"internal/modules/*/application/**",
		},
		Deny: []string{
			"github.com/gin-gonic/gin",
			"github.com/gin-gonic/gin/**",
			"gorm.io/**",
		},
		Why: "business rules outlive the web framework and the ORM; keeping both out is what allows either to be replaced without touching them",
	},
	{
		Name: "shared never depends on a module",
		From: []string{"internal/shared/**"},
		Deny: []string{"internal/modules/**"},
		Why:  "shared sits at the bottom of the graph — a shared package that reaches into a module makes every other module depend on that one, transitively and invisibly",
	},
	{
		Name: "generated transport types stay out of shared",
		From: []string{"internal/shared/**"},
		Deny: []string{"internal/openapi/**"},
		Why:  "shared code that speaks the contract's types can only be reused by callers that also speak them, and regenerating the contract then ripples through code that has nothing to do with HTTP",
	},
}

// Check walks root (the repository root) and returns every violation found.
func Check(root string) ([]Violation, error) {
	modulePath, err := modulePath(root)
	if err != nil {
		return nil, err
	}

	var violations []Violation
	internalDir := filepath.Join(root, "internal")

	walkErr := filepath.WalkDir(internalDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			// testdata is the toolchain's own escape hatch for fixture code; it
			// is never built, so it is never a real boundary crossing.
			if d.Name() == "testdata" {
				return fs.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}

		rel, relErr := filepath.Rel(root, path)
		if relErr != nil {
			return relErr
		}
		relSlash := filepath.ToSlash(rel)
		pkg := pathDir(relSlash)

		// The generated contract package is not hand-written and has no rules
		// pointed at it as an importer.
		if pkg == "internal/openapi" {
			return nil
		}

		imports, impErr := importsOf(path)
		if impErr != nil {
			return impErr
		}

		for _, imp := range imports {
			// Rewrite this module's own imports to repo-relative paths so the
			// patterns above don't have to repeat the module path.
			target := imp
			if after, ok := strings.CutPrefix(imp, modulePath+"/"); ok {
				target = after
			}

			violations = append(violations, checkRules(relSlash, pkg, imp, target)...)
			if v, bad := checkEncapsulation(relSlash, pkg, imp, target); bad {
				violations = append(violations, v)
			}
		}
		return nil
	})
	if walkErr != nil {
		return nil, walkErr
	}
	return violations, nil
}

func checkRules(file, pkg, rawImport, target string) []Violation {
	var out []Violation
	for _, r := range rules {
		if !matchAny(r.From, pkg) {
			continue
		}
		if matchAny(r.Deny, target) {
			out = append(out, Violation{File: file, Import: rawImport, Rule: r.Name, Why: r.Why})
		}
	}
	return out
}

// checkEncapsulation enforces the rule that makes a module a module: the ONLY
// importable package of internal/modules/<m> from outside it is the module root
// itself. Its subpackages are private, including to the composition root.
//
// Without this, "modular" means "the files are in folders". With it, a module's
// internals can be reorganised freely because nothing outside can name them.
func checkEncapsulation(file, pkg, rawImport, target string) (Violation, bool) {
	importedModule, subpackage := moduleOf(target)
	if importedModule == "" || subpackage == "" {
		return Violation{}, false // not a module import, or the module root itself
	}
	if importingModule, _ := moduleOf(pkg); importingModule == importedModule {
		return Violation{}, false // a module may import its own internals
	}

	return Violation{
		File:   file,
		Import: rawImport,
		Rule:   "a module's subpackages are private to it",
		Why: fmt.Sprintf(
			"import %q and use its public contract instead — everything below it is free to change precisely because nothing outside can name it",
			importedModule,
		),
	}, true
}

// moduleOf splits "internal/modules/users/application/x" into
// ("internal/modules/users", "application/x"). It returns an empty module for
// paths outside internal/modules, and an empty subpackage for the module root.
func moduleOf(pkg string) (module, subpackage string) {
	const prefix = "internal/modules/"
	rest, ok := strings.CutPrefix(pkg, prefix)
	if !ok || rest == "" {
		return "", ""
	}
	name, sub, _ := strings.Cut(rest, "/")
	if name == "" {
		return "", ""
	}
	return prefix + name, sub
}

func matchAny(patterns []string, path string) bool {
	for _, p := range patterns {
		if match(p, path) {
			return true
		}
	}
	return false
}

// match implements the two-wildcard pattern language described on rule.
func match(pattern, path string) bool {
	pp := strings.Split(pattern, "/")
	ps := strings.Split(path, "/")

	for i, seg := range pp {
		if seg == "**" {
			// Only valid as the final segment; matches the remainder,
			// including nothing at all.
			return i <= len(ps)
		}
		if i >= len(ps) {
			return false
		}
		if seg != "*" && seg != ps[i] {
			return false
		}
	}
	return len(pp) == len(ps)
}

func pathDir(relSlash string) string {
	idx := strings.LastIndex(relSlash, "/")
	if idx < 0 {
		return "."
	}
	return relSlash[:idx]
}

func importsOf(path string) ([]string, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
	if err != nil {
		return nil, fmt.Errorf("parsing %s: %w", path, err)
	}

	out := make([]string, 0, len(file.Imports))
	for _, spec := range file.Imports {
		unquoted, err := strconv.Unquote(spec.Path.Value)
		if err != nil {
			continue
		}
		out = append(out, unquoted)
	}
	return out, nil
}

// modulePath reads the module directive from go.mod. Reading it rather than
// hardcoding it keeps the checker correct after the module is renamed — a
// rename that broke the checker would disable it silently, which is the one
// failure mode a guard must not have.
func modulePath(root string) (string, error) {
	data, err := os.ReadFile(filepath.Join(root, "go.mod"))
	if err != nil {
		return "", fmt.Errorf("reading go.mod: %w", err)
	}
	for _, line := range strings.Split(string(data), "\n") {
		if rest, ok := strings.CutPrefix(strings.TrimSpace(line), "module "); ok {
			return strings.TrimSpace(rest), nil
		}
	}
	return "", fmt.Errorf("no module directive in %s/go.mod", root)
}
