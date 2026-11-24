<!-- DRAFT for Llorenç to review and rewrite in his own voice before it is published. -->

# How Kairotic is built

*[Leer en castellano](how-kairotic-is-built.es.md)*

Kairotic is made by a musician and an AI, and I would rather say so plainly than have you find it out
from the commit log.

## Who decides

I am a pianist. Kairotic comes from years of improvising, teaching and thinking about how musicians
work with time, and the questions it asks are musical ones. The direction of the project — what it is
for, what it should become, which ideas go ahead and which wait — is decided by people, and so far
mostly by me. Those decisions are taken in the open, in
[Discussions](https://github.com/bonuoq/kairotic/discussions): each line of work starts there as an idea,
is argued there, and the choices made are written down there. If you want to know why something is
the way it is, that is where to look, and that is where you can change it.

## Who writes the code

Much of the code is written by [Claude Code](https://claude.com/claude-code), Anthropic's coding
assistant, working with me in sessions: I describe what a study or a component should do and why,
we discuss the design, Claude writes the code and its tests, and I try it, play it, and decide.
Studies come first, small pages that try one idea, and only what proves itself moves into the app.

You can see this in every commit Claude helped write:

- I am its author and I sign it off: I answer for it, as the
  [DCO](../CONTRIBUTING.md#developer-certificate-of-origin-dco) asks of everyone;
- it carries a `Co-Authored-By: Claude …` line, and
- a `Claude-Session:` link to the session it came from.

Nothing is hidden: the history of the code is the history of those conversations.

## What keeps it sound

- **Tests.** Every change comes with its tests, and nothing is merged until they pass: the app's tests run
  in a headless browser on every pull request, the studies have their own, and the counterpoint and rules
  engines are checked against known results. When something breaks, a test is added that would have
  caught it.
- **Small steps.** Work goes through pull requests, one idea at a time, each with its discussion.
- **Open code.** Everything is under the [MPL-2.0](../LICENSE); you can read, run and change all of it.

## Your Claude, not mine

Kairotic lets you work with Claude inside the app — to write components, build patches, answer in a
canon. That Claude is always **yours**: in Kairotic Pages you use your own Anthropic API key, kept in
your browser; inside claude.ai, your own claude.ai account. No Claude account of the project is shared
with the people who use Kairotic, and nothing you do is paid for or seen through mine.

## If you contribute

You are welcome to work the same way, with an AI assistant or without one. Either way the same rules
hold: tests for what you change, a discussion for what changes direction, and your own sign-off on every
commit ([DCO](../CONTRIBUTING.md#developer-certificate-of-origin-dco)) — because whoever submits a change is
responsible for it, whoever typed it.

— Llorenç Prats
