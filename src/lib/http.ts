export const readJsonResponse = async <T>(response: Response): Promise<T | null> => {
  const rawText = await response.text();

  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
};
