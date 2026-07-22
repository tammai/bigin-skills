// Package domain holds the posts module's entities — pure, dependency-free.
package domain

import "time"

type Post struct {
	ID        string
	AuthorID  *string // nullable: anonymized (nil) when the author is erased
	Title     string
	Body      string
	CreatedAt time.Time
	UpdatedAt time.Time
	Version   int
	DeletedAt *time.Time
}
