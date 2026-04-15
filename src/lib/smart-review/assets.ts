import type { SmartReviewDocument } from '@/db/smart-review-schema';

export type SmartAssetSegmentType =
  | 'basic_info'
  | 'time_node'
  | 'submission_requirement'
  | 'technical_spec'
  | 'scoring_item'
  | 'qualification_requirement';

export interface SmartAssetSegment {
  segmentId: string;
  segmentType: SmartAssetSegmentType;
  title: string;
  content: string;
  source: string;
  orderNo: number;
}

export interface SmartAssetRequirementDraft {
  category: string;
  item: string;
  detail: string;
  segmentId: string;
  source: string;
  isMandatory: boolean;
  confidence: number;
}

function toArray<T extends Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value.filter((x): x is T => typeof x === 'object' && x !== null);
  }
  return [];
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export function deriveSegmentsAndRequirements(document: SmartReviewDocument): {
  segments: SmartAssetSegment[];
  requirements: SmartAssetRequirementDraft[];
} {
  const segments: SmartAssetSegment[] = [];
  const requirements: SmartAssetRequirementDraft[] = [];
  let orderNo = 1;

  const pushRequirement = (
    segment: SmartAssetSegment,
    requirement: Omit<SmartAssetRequirementDraft, 'segmentId' | 'source'>
  ) => {
    requirements.push({
      ...requirement,
      segmentId: segment.segmentId,
      source: segment.source,
    });
  };

  const basicInfo = (document.basicInfo ?? {}) as Record<string, unknown>;
  const basicPairs = [
    ['项目名称', basicInfo.projectName ?? document.projectName],
    ['项目编号', basicInfo.projectCode ?? document.projectCode],
    ['招标单位', basicInfo.tenderOrganization ?? document.tenderOrganization],
    ['招标代理', basicInfo.tenderAgent ?? document.tenderAgent],
    ['招标方式', basicInfo.tenderMethod ?? document.tenderMethod],
    ['项目预算', basicInfo.projectBudget ?? document.projectBudget],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (basicPairs.length > 0) {
    const segmentId = `seg-basic-${orderNo}`;
    const content = basicPairs
      .map(([label, value]) => `${label}: ${stringifyValue(value)}`)
      .join('\n');
    const segment: SmartAssetSegment = {
      segmentId,
      segmentType: 'basic_info',
      title: '项目基本信息',
      content,
      source: 'basicInfo',
      orderNo: orderNo++,
    };
    segments.push(segment);
  }

  const timeNodes = toArray<Record<string, unknown>>(document.timeNodes);
  timeNodes.forEach((node, index) => {
    const nodeName = stringifyValue(node.name || `时间节点-${index + 1}`);
    const time = stringifyValue(node.time);
    const location = stringifyValue(node.location);
    const segment: SmartAssetSegment = {
      segmentId: `seg-time-${index + 1}`,
      segmentType: 'time_node',
      title: nodeName || `时间节点-${index + 1}`,
      content: `时间: ${time || '-'}${location ? `\n地点: ${location}` : ''}`,
      source: 'timeNodes',
      orderNo: orderNo++,
    };
    segments.push(segment);
    pushRequirement(segment, {
      category: '时间节点',
      item: nodeName || `时间节点-${index + 1}`,
      detail: `时间要求: ${time || '-'}${location ? `，地点: ${location}` : ''}`,
      isMandatory: true,
      confidence: 90,
    });
  });

  const submissionRequirements = toArray<Record<string, unknown>>(document.submissionRequirements);
  submissionRequirements.forEach((item, index) => {
    const requirement = stringifyValue(item.requirement || item.name || `提交要求-${index + 1}`);
    const copies = stringifyValue(item.copies);
    const segment: SmartAssetSegment = {
      segmentId: `seg-submit-${index + 1}`,
      segmentType: 'submission_requirement',
      title: requirement || `提交要求-${index + 1}`,
      content: copies ? `${requirement}\n份数: ${copies}` : requirement,
      source: 'submissionRequirements',
      orderNo: orderNo++,
    };
    segments.push(segment);
    pushRequirement(segment, {
      category: '提交要求',
      item: requirement || `提交要求-${index + 1}`,
      detail: copies ? `提交要求: ${requirement}；份数: ${copies}` : `提交要求: ${requirement}`,
      isMandatory: true,
      confidence: 88,
    });
  });

  const technicalSpecs = toArray<Record<string, unknown>>(document.technicalSpecs);
  technicalSpecs.forEach((spec, index) => {
    const name = stringifyValue(spec.name || spec.specName || `技术参数-${index + 1}`);
    const req = stringifyValue(spec.requirement || spec.specRequirement || spec.value || '');
    const segment: SmartAssetSegment = {
      segmentId: `seg-tech-${index + 1}`,
      segmentType: 'technical_spec',
      title: name || `技术参数-${index + 1}`,
      content: req || name,
      source: 'technicalSpecs',
      orderNo: orderNo++,
    };
    segments.push(segment);
    pushRequirement(segment, {
      category: stringifyValue(spec.category || '技术要求'),
      item: name || `技术参数-${index + 1}`,
      detail: req || name,
      isMandatory: true,
      confidence: 86,
    });
  });

  const scoringItems = toArray<Record<string, unknown>>(document.scoringItems);
  scoringItems.forEach((scoring, index) => {
    const itemName = stringifyValue(scoring.itemName || scoring.name || `评分项-${index + 1}`);
    const criteria = stringifyValue(scoring.criteria || scoring.requirement || '');
    const score = stringifyValue(scoring.score || scoring.scoreValue);
    const segment: SmartAssetSegment = {
      segmentId: `seg-score-${index + 1}`,
      segmentType: 'scoring_item',
      title: itemName || `评分项-${index + 1}`,
      content: `${criteria || itemName}${score ? `\n分值: ${score}` : ''}`,
      source: 'scoringItems',
      orderNo: orderNo++,
    };
    segments.push(segment);
    pushRequirement(segment, {
      category: stringifyValue(scoring.category || '评分细则'),
      item: itemName || `评分项-${index + 1}`,
      detail: `${criteria || itemName}${score ? `（分值: ${score}）` : ''}`,
      isMandatory: false,
      confidence: 84,
    });
  });

  const qualifications = toArray<Record<string, unknown>>(document.qualificationRequirements);
  qualifications.forEach((qualification, index) => {
    const name = stringifyValue(
      qualification.requirement || qualification.name || `资质要求-${index + 1}`
    );
    const desc = stringifyValue(qualification.description || qualification.detail || '');
    const segment: SmartAssetSegment = {
      segmentId: `seg-qual-${index + 1}`,
      segmentType: 'qualification_requirement',
      title: name || `资质要求-${index + 1}`,
      content: desc || name,
      source: 'qualificationRequirements',
      orderNo: orderNo++,
    };
    segments.push(segment);
    pushRequirement(segment, {
      category: stringifyValue(qualification.category || '资质要求'),
      item: name || `资质要求-${index + 1}`,
      detail: desc || name,
      isMandatory: true,
      confidence: 85,
    });
  });

  return { segments, requirements };
}
