/* Mini 4X calls. Placeholders: {p} the empire acting, {o} its rival, {c} a city's name, {n} a number. */

export const CONQUEST_LINES = {
  start: ["Two empires rise: {p} and {o}.", "{p} and {o} each found a capital. Let the race begin."],
  found: ["{p} founds {c}.", "Settlers from {p} build {c}.", "{c} is born: a new city for {p}."],
  tech: ["{p} reaches Tech {n}: everything gets a little stronger.", "Breakthrough! {p} is now at Tech {n}."],
  contact: ["The borders meet. War!", "{p} and {o} now share a border. Swords out."],
  capture: ["{p} captures {c}!", "{c} falls to {p}!", "{p} storms {c} and takes it."],
  repelled: ["{c} holds against {p}.", "{p}'s attack on {c} is thrown back."],
  capital: ["{p} takes {c}, the enemy capital! It's over.", "{c} has fallen! {p} conquers the capital."],
};

export const fillConquestLine = (line: string, values: { p: string; o: string; c?: string; n?: number }): string =>
  line.replace(/\{([pocn])\}/g, (_, key: "p" | "o" | "c" | "n") => String(values[key] ?? ""));
