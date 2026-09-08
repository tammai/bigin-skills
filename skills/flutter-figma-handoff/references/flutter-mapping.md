# Material 3 Design Kit → Flutter widgets

The mapping table **is** the contract. A frame built from components in this table hands off to real widgets; a frame using anything else fails handoff by name, because the alternative is an agent inventing a custom-painted lookalike and nobody noticing until it drifts.

**This table is scoped to a Flutter version and must be re-checked against the one the repo pins.** Google's kit tracks the Material spec, which runs ahead of the framework — a component can exist in the kit for a year before a widget ships, and the reverse never happens. `flutter --version` first; when a row is wrong for that version, fix the row rather than working around it.

## Actions

| M3 kit component | Flutter widget | Key props |
|---|---|---|
| Elevated button | `ElevatedButton` | `onPressed`, `icon` via `.icon` |
| Filled button | `FilledButton` | `onPressed`, `.icon` |
| Filled tonal button | `FilledButton.tonal` | `onPressed`, `.tonalIcon` |
| Outlined button | `OutlinedButton` | `onPressed`, `.icon` |
| Text button | `TextButton` | `onPressed`, `.icon` |
| Icon button (standard) | `IconButton` | `icon`, `onPressed`, `isSelected` + `selectedIcon` |
| Icon button (filled / tonal / outlined) | `IconButton.filled` / `.filledTonal` / `.outlined` | as above |
| FAB | `FloatingActionButton` | `onPressed`, `child` |
| FAB (small / large / extended) | `FloatingActionButton.small` / `.large` / `.extended` | `.extended` takes `label` + `icon` |
| Segmented button | `SegmentedButton` | `segments`, `selected`, `onSelectionChanged`, `multiSelectionEnabled` |

## Containment

| M3 kit component | Flutter widget | Key props |
|---|---|---|
| Card (elevated / filled / outlined) | `Card` / `Card.filled` / `Card.outlined` | `child`; tap behaviour is an `InkWell` inside, not a card prop |
| Dialog (basic) | `AlertDialog` | `title`, `content`, `actions` — via `showDialog` |
| Dialog (full-screen) | `Dialog.fullscreen` | `child` |
| Bottom sheet (modal) | `showModalBottomSheet` | `isScrollControlled`, `showDragHandle` |
| Bottom sheet (standard) | `BottomSheet` | `onClosing`, `builder` |
| Snackbar | `SnackBar` | `content`, `action` — via `ScaffoldMessenger.of(context).showSnackBar` |
| Tooltip | `Tooltip` | `message`, `child` |
| Divider | `Divider` / `VerticalDivider` | `height`, `indent` |
| Badge | `Badge` | `label`, `child`, `isLabelVisible` |

## Navigation

| M3 kit component | Flutter widget | Key props |
|---|---|---|
| Navigation bar | `NavigationBar` | `destinations` (`NavigationDestination`), `selectedIndex`, `onDestinationSelected` |
| Navigation rail | `NavigationRail` | `destinations` (`NavigationRailDestination`), `extended` |
| Navigation drawer | `NavigationDrawer` | `children` (`NavigationDrawerDestination`), `selectedIndex` |
| Top app bar (small) | `AppBar` | `title`, `actions`, `leading` |
| Top app bar (medium / large) | `SliverAppBar.medium` / `.large` | inside a `CustomScrollView` |
| Top app bar (center-aligned) | `AppBar` | `centerTitle: true` |
| Bottom app bar | `BottomAppBar` | `child`, `notchMargin` |
| Tabs | `TabBar` + `TabBarView` | `tabs`, `controller`; `TabBar.secondary` for the secondary style |
| Search bar / search view | `SearchBar` / `SearchAnchor` | `SearchAnchor.bar` builds both together |

## Selection and input

| M3 kit component | Flutter widget | Key props |
|---|---|---|
| Text field (filled) | `TextField` | `decoration: InputDecoration(filled: true)` |
| Text field (outlined) | `TextField` | `decoration: InputDecoration(border: OutlineInputBorder())` |
| Checkbox | `Checkbox` / `CheckboxListTile` | `value`, `onChanged`, `tristate` |
| Radio button | `Radio` / `RadioListTile` | `value`, `groupValue`, `onChanged` |
| Switch | `Switch` / `SwitchListTile` | `value`, `onChanged`, `thumbIcon` |
| Slider | `Slider` / `RangeSlider` | `value`, `onChanged`, `divisions` |
| Chip (assist) | `ActionChip` | `label`, `avatar`, `onPressed` |
| Chip (filter) | `FilterChip` | `selected`, `onSelected` |
| Chip (input) | `InputChip` | `onDeleted`, `selected` |
| Chip (suggestion) | `ActionChip` | the M3 suggestion chip is an action chip with no leading icon |
| Menu | `MenuAnchor` | `menuChildren` (`MenuItemButton`, `SubmenuButton`) |
| Dropdown menu | `DropdownMenu` | `dropdownMenuEntries`, `initialSelection` |
| List item | `ListTile` | `leading`, `title`, `subtitle`, `trailing` |
| Date picker | `showDatePicker` / `DatePickerDialog` | `firstDate`, `lastDate` |
| Time picker | `showTimePicker` / `TimePickerDialog` | `initialTime` |
| Progress (linear / circular) | `LinearProgressIndicator` / `CircularProgressIndicator` | `value` — omit for indeterminate |

## Components the kit has and Flutter may not

**Do not treat this as a closed list, and do not treat it as permanent.** It is a starting point for the check, not a substitute for it: verify against `flutter --version` in the repo, because these move.

The Material 3 Expressive additions are the usual source of a mismatch — split buttons, button groups, FAB menus, the expressive toolbar, and the expressive loading indicator all appeared in the spec and the kit ahead of the framework. Anything in that family gets checked before it is promised.

**When a frame uses a component with no row in this file, handoff stops** and reports: the component name, the Flutter version checked against, and the two ways forward — redraw the frame with a component that maps, or accept a hand-built widget as a deliberate, recorded exception. Never a silent custom-painted lookalike.

## What this file does not cover

- **Cupertino.** Out of scope by design: BigIn mobile apps are API clients on Material defaults, and iOS-flavoured design is a per-client decision.
- **Code Connect.** Figma's mechanism has no Flutter equivalent; this file plays that role, which is exactly why a missing row has to be an error rather than a shrug.
- **Layout, spacing and elevation.** The kit's grid does not map to widgets one-for-one. Read those off the frame and build them with ordinary layout widgets.
