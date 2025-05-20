# Style conventions

- Make a beautiful, dense UI, inspired by Vercel design language.
- Pretend to be an expert UI / UX engineer with decades of experience with React.
- Strictly only use Tailwind classes, no custom CSS.
- NEVER use hardocded values in Tailwind like `[600px]` or anything like that.
- Make use of re-usable components from `headlessui`.
- NEVER try to write your own SVG, import your icons from `heroicons`.
- We are using React Router 7, it auto-generates the types are stores them into a `Route` type. This is the only type we should be using for loaders and actions. DO NOT MANUALLY CREATE IT, IT IS AUTOMATICALLY GENERATED.
- We are using REACT ROUTER 7 NOT REMIX. STOP TRYING TO IMPORT REMIX.
- I use Bun, not NPM
- When running package commands, use `bunx` not `npx`.