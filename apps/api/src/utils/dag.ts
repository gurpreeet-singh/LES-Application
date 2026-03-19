// DAG (Directed Acyclic Graph) utilities

export function hasCycle(edges: { from: number; to: number }[]): boolean {
  const adj = new Map<number, number[]>();
  const nodes = new Set<number>();

  for (const { from, to } of edges) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(to);
    nodes.add(from);
    nodes.add(to);
  }

  const visited = new Set<number>();
  const inStack = new Set<number>();

  function dfs(node: number): boolean {
    visited.add(node);
    inStack.add(node);

    for (const neighbor of adj.get(node) || []) {
      if (inStack.has(neighbor)) return true;
      if (!visited.has(neighbor) && dfs(neighbor)) return true;
    }

    inStack.delete(node);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node) && dfs(node)) return true;
  }

  return false;
}

export function topologicalSort(edges: { from: number; to: number }[], nodes: number[]): number[] {
  const adj = new Map<number, number[]>();
  const inDegree = new Map<number, number>();

  for (const n of nodes) {
    adj.set(n, []);
    inDegree.set(n, 0);
  }

  for (const { from, to } of edges) {
    adj.get(from)!.push(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
  }

  const queue: number[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) queue.push(node);
  }

  const result: number[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);

    for (const neighbor of adj.get(node) || []) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }

  return result;
}
