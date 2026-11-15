export type DeletionAction = 'continue' | 'cancel' | 'permanent';

export const deletionCallbackPattern =
  /^delete:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(continue|cancel|permanent)$/i;

export function parseDeletionCallback(
  value: string,
): { interactionId: string; action: DeletionAction } | undefined {
  const match = deletionCallbackPattern.exec(value);
  if (!match?.[1] || !match[2]) return undefined;
  return {
    interactionId: match[1],
    action: match[2].toLowerCase() as DeletionAction,
  };
}
