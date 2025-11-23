# TODO

## FEAT

- [ ] history page with past banners, show rerun potential
- [ ] nicer input ui?
- [ ] perf fix: accounts tab without unmounting?
- [ ] vitest
- [ ] redesign plan and what this means ui to be more visual, and response for mobile (hard)
  - [x] summary view redesign
- [x] ssr
- [x] priority list drag and drop does not work on mobile
- [x] fix prio list grab and drop issues
- [x] move footer to top
- [x] fix agent and w engine pity and guaranteed not working for A ranks
- [x] add A rank support
- [x] pull 1 and pull 10 buttons to quickly change available pulls and pity
- [x] mindscape support with nice ui, maybe small + - buttons for targets
- [x] planner should work for N phases, currently 2 phases are hardcoded, and even first banner is in the second phase

## HELP

- [ ] prerender 404 page and show it for every not found route
- [ ] ssr select targets section banners. fixes CLS, and fetches images early (why are they img src data webp base64'd into the html?). but removing clientonly hydration mismatches...
