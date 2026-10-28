# RainbowText

A Claude Code mod that puts real color in Claude's replies, so the important parts stand out at a glance.

| Color | Meaning |
| --- | --- |
| Blue | Links, clickable to open in your browser |
| Yellow | Main highlight |
| Orange | Second highlight, when yellow is already used |
| Red | Take extra care |
| Green | Summary sentences only |

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install reply-colors --marketplace SeanKogan/RainbowText
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install reply-colors --marketplace SeanKogan/RainbowText
```

## How it works

The mod tells Claude to wrap a few key words per reply in tags such as `{{y:Share}}`, and then draws those words in color: `y` yellow, `o` orange, `r` red, `g` green. Bare `https://` links are drawn in blue. Replies without tags or links are drawn as usual.

Slash command output is colored the same way. `/btw` side questions are answered by the mod itself (same side-question rules, no tools) so the answer shows up colored in the transcript instead of in the plain overlay.

## License

MIT
