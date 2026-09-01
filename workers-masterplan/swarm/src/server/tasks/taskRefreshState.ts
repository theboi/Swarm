/** A transient repository read error must never erase the last graph shown to operators. */
export function retainLastGoodTaskGraph<TManifest, TNode>(manifest: TManifest | undefined, nodes: readonly TNode[], manifestError: string): { manifest: TManifest | undefined; nodes: TNode[]; manifestError: string } {
  return { manifest, nodes: [...nodes], manifestError };
}
