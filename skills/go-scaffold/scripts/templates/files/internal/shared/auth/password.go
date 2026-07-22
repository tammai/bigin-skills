package auth

import "github.com/alexedwards/argon2id"

// DummyPasswordHash is a fixed, valid argon2id-encoded hash the login use-case
// verifies against when no account matches the submitted email. Verifying it
// costs the same memory-hard argon2id time as verifying a real user's hash, so
// login response latency no longer leaks whether an account exists — both the
// "no such user" and "wrong password" branches pay one Verify and return the
// same generic error (ADR §7). No password matches it; the plaintext behind it
// is irrelevant. Regenerate with argon2id.CreateHash if the baseline params
// (NewArgon2Hasher's defaults) change materially.
const DummyPasswordHash = "$argon2id$v=19$m=19456,t=2,p=1$faQQHuhjlZ4ecZ9lcDzHpA$iDIq+XatcbAZksZgO/5vPSuCZxH2TNFY6Y7Jrca9/Vo"

// PasswordHasher is the seam the users module's application layer depends on —
// a fake satisfies it in unit tests so they never pay argon2id's (deliberate)
// cost.
type PasswordHasher interface {
	Hash(plain string) (string, error)
	Verify(hash, plain string) (bool, error)
}

// Argon2Hasher produces the same $argon2id$... encoded format as the Node
// scaffold's `argon2` package (ADR §7). Parameters come from config.
type Argon2Hasher struct {
	params *argon2id.Params
}

func NewArgon2Hasher(memory, iterations uint32, parallelism uint8) *Argon2Hasher {
	return &Argon2Hasher{params: &argon2id.Params{
		Memory:      memory,
		Iterations:  iterations,
		Parallelism: parallelism,
		SaltLength:  16,
		KeyLength:   32,
	}}
}

func (h *Argon2Hasher) Hash(plain string) (string, error) {
	return argon2id.CreateHash(plain, h.params)
}

func (h *Argon2Hasher) Verify(hash, plain string) (bool, error) {
	return argon2id.ComparePasswordAndHash(plain, hash)
}
