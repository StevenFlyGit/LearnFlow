/**
 * 知识树共享工具函数 — 从 KnowledgeTree 提取，供多模块复用
 */
import { putNode, putDomain, type KnowledgeNode, type Domain } from './db';

export const getNow = () => Date.now();
export const generateNodeId = (prefix = 'node') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const syncDomainHours = async (
  domainId: string,
  allNodes: KnowledgeNode[],
  domains: Domain[],
  upsertDomain: (d: Domain) => void
) => {
  const domain = domains.find(d => d.id === domainId);
  if (!domain) return;
  const rootNodes = allNodes.filter(n => n.parentId === null);
  const totalHours = rootNodes.reduce((sum, n) => sum + n.estimatedHours, 0);
  if (domain.totalHours !== totalHours) {
    const updatedDomain = { ...domain, totalHours };
    await putDomain(updatedDomain);
    upsertDomain(updatedDomain);
  }
};

export const syncParentHours = async (
  parentId: string | null,
  allNodes: KnowledgeNode[],
  upsertNode: (n: KnowledgeNode) => void,
  domainId: string,
  domains: Domain[],
  upsertDomain: (d: Domain) => void
) => {
  if (!parentId) {
    await syncDomainHours(domainId, allNodes, domains, upsertDomain);
    return;
  }
  const parentNode = allNodes.find(n => n.id === parentId);
  if (!parentNode) return;
  const children = allNodes.filter(n => n.parentId === parentId);
  const totalHours = children.length > 0
    ? children.reduce((sum, child) => sum + child.estimatedHours, 0)
    : parentNode.estimatedHours;
  let nextNodes = allNodes;
  if (parentNode.estimatedHours !== totalHours) {
    const updatedParent = { ...parentNode, estimatedHours: totalHours };
    await putNode(updatedParent);
    upsertNode(updatedParent);
    nextNodes = allNodes.map(n => n.id === parentNode.id ? updatedParent : n);
  }
  await syncParentHours(parentNode.parentId, nextNodes, upsertNode, domainId, domains, upsertDomain);
};

export const recalculateAllParentHours = async (
  allNodes: KnowledgeNode[],
  upsertNode: (n: KnowledgeNode) => void,
  domainId: string,
  domains: Domain[],
  upsertDomain: (d: Domain) => void
) => {
  const parentNodes = allNodes
    .filter(n => allNodes.some(child => child.parentId === n.id))
    .sort((a, b) => b.level - a.level);
  
  let currentNodes = [...allNodes];
  for (const parentNode of parentNodes) {
    const children = currentNodes.filter(n => n.parentId === parentNode.id);
    const totalHours = children.reduce((sum, child) => sum + child.estimatedHours, 0);
    
    if (parentNode.estimatedHours !== totalHours) {
      const updatedParent = { ...parentNode, estimatedHours: totalHours };
      await putNode(updatedParent);
      upsertNode(updatedParent);
      currentNodes = currentNodes.map(n => n.id === parentNode.id ? updatedParent : n);
    }
  }
  await syncDomainHours(domainId, currentNodes, domains, upsertDomain);
};
