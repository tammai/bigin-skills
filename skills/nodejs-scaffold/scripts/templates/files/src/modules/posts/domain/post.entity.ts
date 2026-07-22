// Domain model — PURE (domain → disallow *). No local imports.

export interface Post {
  id: string
  authorId: string | null // nullable: anonymized when the author is erased
  title: string
  body: string
  createdAt: Date
  updatedAt: Date
  version: number
  deletedAt: Date | null
}

// A post joined with its author's public name for the list endpoint.
export interface PostListItem {
  id: string
  author_id: string | null
  author_name: string | null
  title: string
  body: string
  created_at: string
  version: number
}
