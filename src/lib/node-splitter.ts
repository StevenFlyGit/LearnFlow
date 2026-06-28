/**
 * 节点拆分逻辑 — 将超大叶子节点拆分为多个子节点
 */
import { putNode, type KnowledgeNode, type Domain } from './db';
import { generateNodeId, syncParentHours } from './tree-utils';

/**
 * 计算拆分后的工时数组
 * @example computeSplit(7, 2) → [2, 2, 2, 1]
 * @example computeSplit(6, 2) → [2, 2, 2]
 */
export function computeSplit(estimatedHours: number, maxLeafHours: number): number[] {
  if (estimatedHours <= maxLeafHours) return [estimatedHours];
  
  const parts: number[] = [];
  let remaining = estimatedHours;
  
  while (remaining > 0) {
    const current = Math.min(maxLeafHours, remaining);
    parts.push(current);
    remaining -= current;
  }
  
  return parts;
}

/**
 * 扫描所有节点，找出需要拆分的超大叶子节点（仅 pending 状态）
 */
export function findOversizedLeaves(
  nodes: KnowledgeNode[],
  maxLeafHours: number
): KnowledgeNode[] {
  const hasChildren = new Set(
    nodes.filter(n => n.parentId !== null).map(n => n.parentId!)
  );
  
  return nodes.filter(node => {
    // 必须是叶子节点（没有子节点）
    if (hasChildren.has(node.id)) return false;
    // 必须是 pending 状态
    if (node.status !== 'pending') return false;
    // 预估工时必须超过阈值
    if (node.estimatedHours <= maxLeafHours) return false;
    return true;
  });
}

/**
 * 执行拆分：创建子节点、更新原节点、同步工时
 * @returns 更新后的完整节点列表
 */
export async function executeSplit(
  node: KnowledgeNode,
  maxLeafHours: number,
  allNodes: KnowledgeNode[],
  upsertNode: (n: KnowledgeNode) => void,
  domains: Domain[],
  upsertDomain: (d: Domain) => void
): Promise<KnowledgeNode[]> {
  const splitHours = computeSplit(node.estimatedHours, maxLeafHours);
  
  // 原节点转为父节点：清除 startDate
  const updatedParent: KnowledgeNode = {
    ...node,
    startDate: undefined,
  };
  await putNode(updatedParent);
  upsertNode(updatedParent);
  
  // 创建子节点
  const newChildren: KnowledgeNode[] = [];
  for (let i = 0; i < splitHours.length; i++) {
    const child: KnowledgeNode = {
      id: generateNodeId('split'),
      domainId: node.domainId,
      parentId: node.id,
      title: `${node.title} - Part ${i + 1}`,
      level: node.level + 1,
      estimatedHours: splitHours[i],
      status: 'pending',
      order: i,
    };
    await putNode(child);
    newChildren.push(child);
  }
  
  // 同步父级工时（虽然原节点 estimatedHours 不变，但需要确保树结构正确）
  let nextNodes = allNodes.map(n => n.id === node.id ? updatedParent : n);
  nextNodes = [...nextNodes, ...newChildren];
  
  await syncParentHours(
    node.parentId,
    nextNodes,
    upsertNode,
    node.domainId,
    domains,
    upsertDomain
  );
  
  return nextNodes;
}

/**
 * 批量拆分所有超标节点
 * @returns 最终更新后的节点列表
 */
export async function executeSplitAll(
  oversizedNodes: KnowledgeNode[],
  maxLeafHours: number,
  allNodes: KnowledgeNode[],
  upsertNode: (n: KnowledgeNode) => void,
  domains: Domain[],
  upsertDomain: (d: Domain) => void
): Promise<KnowledgeNode[]> {
  let currentNodes = [...allNodes];
  
  for (const node of oversizedNodes) {
    // 每次拆分后重新获取最新节点状态
    const freshNode = currentNodes.find(n => n.id === node.id);
    if (!freshNode) continue;
    
    currentNodes = await executeSplit(
      freshNode,
      maxLeafHours,
      currentNodes,
      upsertNode,
      domains,
      upsertDomain
    );
  }
  
  return currentNodes;
}
