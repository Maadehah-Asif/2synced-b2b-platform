export function validatePassword(password: string): string | null {
  if (!password || password.length < 12) {
    return "Password must be at least 12 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  if (!/[!@#$%^&*()_\-+={}\[\]|:;"'<>,.?/~`]/.test(password)) {
    return "Password must include at least one special character.";
  }
  return null;
}

export function validateWorkspaceName(name: string): string | null {
  if (!name) return "Workspace name is required.";
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return "Workspace name must be at least 3 characters.";
  }
  if (trimmed.length > 64) {
    return "Workspace name must be at most 64 characters.";
  }
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) {
    return "Workspace name can only contain letters, numbers, spaces, dashes and underscores.";
  }
  return null;
}
