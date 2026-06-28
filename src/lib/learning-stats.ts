/**
 * 学习统计工具函数 - 记录和分析知识点状态变更
 */
import {
  getLearningStats,
  getLearningStatsByNode,
  putLearningStat,
  deleteLearningStat,
  type LearningStatRecord,
  type NodeStatus,
} from '@/lib/db';

const getNow = () => Date.now();

// 生成唯一ID
function generateStatId(): string {
  return `stat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// 格式化日期为 YYYY-MM-DD
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 记录知识点状态变更
 */
export async function recordStatusChange(
  nodeId: string,
  fromStatus: NodeStatus | null,
  toStatus: NodeStatus
): Promise<void> {
  const record: LearningStatRecord = {
    id: generateStatId(),
    nodeId,
    fromStatus,
    toStatus,
    timestamp: getNow(),
    createdAt: getNow(),
  };
  
  await putLearningStat(record);
}

/**
 * 计算节点的状态切换次数
 */
export async function getNodeTransitionCounts(nodeId: string): Promise<{
  pendingToInProgress: number;
  inProgressToDone: number;
}> {
  const stats = await getLearningStatsByNode(nodeId);
  
  let pendingToInProgress = 0;
  let inProgressToDone = 0;
  
  for (const stat of stats) {
    if (stat.fromStatus === 'pending' && stat.toStatus === 'in_progress') {
      pendingToInProgress++;
    } else if (stat.fromStatus === 'in_progress' && stat.toStatus === 'done') {
      inProgressToDone++;
    } else if (stat.fromStatus === 'in_progress' && stat.toStatus === 'pending') {
      // 回退：减少计数
      pendingToInProgress = Math.max(0, pendingToInProgress - 1);
    } else if (stat.fromStatus === 'done' && stat.toStatus === 'in_progress') {
      // 回退：减少计数
      inProgressToDone = Math.max(0, inProgressToDone - 1);
    }
  }
  
  return {
    pendingToInProgress,
    inProgressToDone,
  };
}

/**
 * 获取所有节点的状态统计
 */
export async function getAllNodesTransitionCounts(): Promise<
  Record<string, {
    pendingToInProgress: number;
    inProgressToDone: number;
  }>
> {
  const allStats = await getLearningStats();
  const counts: Record<string, {
    pendingToInProgress: number;
    inProgressToDone: number;
  }> = {};
  
  // 初始化所有节点的计数
  const nodeIds = new Set(allStats.map(s => s.nodeId));
  for (const nodeId of nodeIds) {
    counts[nodeId] = { pendingToInProgress: 0, inProgressToDone: 0 };
  }
  
  // 统计每个节点的状态变更
  for (const stat of allStats) {
    if (!counts[stat.nodeId]) {
      counts[stat.nodeId] = { pendingToInProgress: 0, inProgressToDone: 0 };
    }
    
    if (stat.fromStatus === 'pending' && stat.toStatus === 'in_progress') {
      counts[stat.nodeId].pendingToInProgress++;
    } else if (stat.fromStatus === 'in_progress' && stat.toStatus === 'done') {
      counts[stat.nodeId].inProgressToDone++;
    } else if (stat.fromStatus === 'in_progress' && stat.toStatus === 'pending') {
      counts[stat.nodeId].pendingToInProgress = Math.max(0, counts[stat.nodeId].pendingToInProgress - 1);
    } else if (stat.fromStatus === 'done' && stat.toStatus === 'in_progress') {
      counts[stat.nodeId].inProgressToDone = Math.max(0, counts[stat.nodeId].inProgressToDone - 1);
    }
  }
  
  return counts;
}

/**
 * 计算总体统计
 */
export async function getOverallStats(nodes: Array<{ status: NodeStatus }>): Promise<{
  totalNodes: number;
  completedNodes: number;
  inProgressNodes: number;
  pendingNodes: number;
  completionRate: number;
}> {
  const totalNodes = nodes.length;
  const completedNodes = nodes.filter(n => n.status === 'done').length;
  const inProgressNodes = nodes.filter(n => n.status === 'in_progress').length;
  const pendingNodes = nodes.filter(n => n.status === 'pending').length;
  const completionRate = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;
  
  return {
    totalNodes,
    completedNodes,
    inProgressNodes,
    pendingNodes,
    completionRate,
  };
}

/**
 * 获取热力图数据（近12周每天完成的知识点数量）
 */
export async function getHeatmapData(): Promise<Array<{
  date: string;      // YYYY-MM-DD
  count: number;     // 完成数量
}>> {
  const allStats = await getLearningStats();
  
  // 筛选出所有完成状态的记录
  const doneStats = allStats.filter(stat => stat.toStatus === 'done');
  
  // 按日期聚合
  const dateMap: Record<string, number> = {};
  for (const stat of doneStats) {
    const dateStr = formatDate(stat.timestamp);
    dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
  }
  
  // 转换为数组并排序
  const heatmapData = Object.entries(dateMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return heatmapData;
}

/**
 * 计算连续学习天数
 */
export async function getStreakData(): Promise<{
  currentStreak: number;   // 当前连续天数
  longestStreak: number;   // 最长连续天数
  lastStudyDate?: string;  // 最后学习日期
}> {
  const allStats = await getLearningStats();
  
  // 定义"学习日"：当天有任意知识点从 pending 切换到 in_progress 或 done
  const studyDates = new Set<string>();
  
  for (const stat of allStats) {
    if (
      (stat.fromStatus === 'pending' && stat.toStatus === 'in_progress') ||
      (stat.fromStatus === 'pending' && stat.toStatus === 'done') ||
      (stat.fromStatus === null && stat.toStatus === 'in_progress') ||
      (stat.fromStatus === null && stat.toStatus === 'done')
    ) {
      studyDates.add(formatDate(stat.timestamp));
    }
  }
  
  const today = formatDate(getNow());
  const sortedDates = Array.from(studyDates).sort();
  
  // 计算当前连续天数
  let currentStreak = 0;
  let checkDate = new Date(today);
  
  while (true) {
    const dateStr = formatDate(checkDate.getTime());
    if (studyDates.has(dateStr)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  // 计算最长连续天数
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;
  
  for (const dateStr of sortedDates) {
    const currentDate = new Date(dateStr);
    
    if (prevDate) {
      const diffDays = Math.floor(
        (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    
    prevDate = currentDate;
  }
  
  longestStreak = Math.max(longestStreak, tempStreak);
  
  // 最后学习日期
  const lastStudyDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : undefined;
  
  return {
    currentStreak,
    longestStreak,
    lastStudyDate,
  };
}

/**
 * 获取本周每日完成趋势
 */
export async function getWeeklyTrend(): Promise<Array<{
  date: string;
  count: number;
}>> {
  const allStats = await getLearningStats();
  
  // 获取本周一的日期
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  
  // 生成本周7天的日期
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDates.push(formatDate(date.getTime()));
  }
  
  // 统计每天的完成数量
  const dailyCounts: Record<string, number> = {};
  for (const stat of allStats) {
    if (stat.toStatus === 'done') {
      const dateStr = formatDate(stat.timestamp);
      if (weekDates.includes(dateStr)) {
        dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
      }
    }
  }
  
  // 构建结果
  const trend = weekDates.map(date => ({
    date,
    count: dailyCounts[date] || 0,
  }));
  
  return trend;
}
