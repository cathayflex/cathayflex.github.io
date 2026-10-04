/** Display names for both current resources and saved runs using older labels. */
export function resourceLabel(label: string): string {
  const [name, ...details] = label.split(/\s*[·•]\s*/);
  if (!details.length) return label;
  if (/^\d+[A-Z]$/.test(name)) {
    const [description, ...location] = details;
    const seat = /seat|reservation/i.test(description)
      ? `${description} ${name}`
      : /aisle|window|middle/i.test(description)
        ? `${description} seat ${name}`
        : `Seat ${name} on ${description}`;
    return location.length ? `${seat} for ${location.join(" and ")}` : seat;
  }
  if (/^CX\s*\d+/.test(name)) {
    return details.length === 1
      ? `${name} at ${details[0]}`
      : `${name} ${details[0].replace("→", "to")} at ${details[1]}`;
  }
  if (/^up to /i.test(details[0])) return `${name} ${details[0].toLowerCase()}`;
  return `${details.join(" and ")} for ${name}`;
}

/** Seat letters come from the booking label, not the cabin's column index. */
export function seatNumber(label: string | undefined): string | undefined {
  return label?.match(/\b\d{1,3}[A-Z]\b/)?.[0];
}
