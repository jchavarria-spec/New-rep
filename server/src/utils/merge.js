// Replace {{merge_field}} tokens in a template string with values.
export function renderMerge(template, vars = {}) {
  if (!template) return "";
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

// Build the standard merge vars for a contact + agent.
export function mergeVarsFor(contact, user, extra = {}) {
  return {
    first_name: contact.first_name || "there",
    last_name: contact.last_name || "",
    agent_name: user?.name || "Your Agent",
    brokerage: user?.brokerage || "",
    ...extra,
  };
}
