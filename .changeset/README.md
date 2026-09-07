# Changesets

This folder holds [changesets](https://github.com/changesets/changesets) — one markdown file per
user-facing change, declaring which packages bump and by how much.

```bash
pnpm changeset        # add a changeset (pick packages + bump level + summary)
pnpm changeset version  # apply pending changesets → bump versions + update CHANGELOGs
pnpm release          # build + publish (requires explicit confirmation)
```

See the [changesets docs](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md).
