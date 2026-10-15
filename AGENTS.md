<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Keep the app as a mobile-first TanStack web application; native React Native is unsupported by this environment.
- Store frontend demonstration state in the shared Facilitadores provider, never present it as authenticated or durably saved data.
- Keep content sections in distinct file routes and use the shared shell for navigation so desktop and mobile stay consistent.
