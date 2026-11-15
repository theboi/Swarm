/** A transient repository read error must never erase the last graph shown to operators. */
export function retainLastGoodTaskGraph<TManifest, TNode>(manifest: TManifest | undefined, nodes: readonly TNode[], manifestError: string): { manifest: TManifest | undefined; nodes: TNode[]; manifestError: string } {
  return { manifest, nodes: [...nodes], manifestError };
}

/** Stages a full refresh before swapping either half of the operator-visible graph. */
export async function refreshTaskGraphAtomically<TManifest, TNode>(
  current: { manifest: TManifest | undefined; nodes: readonly TNode[] },
  loadCandidate: () => Promise<{ manifest: TManifest; nodes: TNode[] }>,
  classifyError: (error: unknown) => string,
): Promise<{ manifest: TManifest | undefined; nodes: TNode[]; manifestError: string | undefined }> {
  try {
    const candidate = await loadCandidate();
    return { manifest: candidate.manifest, nodes: candidate.nodes, manifestError: undefined };
  } catch (error) {
    return retainLastGoodTaskGraph(current.manifest, current.nodes, classifyError(error));
  }
}
