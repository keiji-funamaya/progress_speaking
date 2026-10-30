import { z } from 'zod'

/**
 * AI 応答の JSON Schema（Structured Outputs 用）と Zod スキーマ。
 *
 * OpenAI 側で JSON Schema を強制し、さらにサーバー側で Zod により再検証します。
 * 自然言語レスポンスを正規表現で parse する実装は行いません。
 */

// ------------------------------------------------------------
// 1. ヘッダー（列意味）推定
// ------------------------------------------------------------
export const headerAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['columns'],
  properties: {
    columns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['columnIndex', 'semanticType', 'confidence', 'reason'],
        properties: {
          columnIndex: { type: 'integer' },
          semanticType: { type: 'string' },
          confidence: { type: 'number' },
          reason: { type: 'string' },
        },
      },
    },
  },
} as const

export const headerAnalysisSchema = z.object({
  columns: z.array(
    z.object({
      columnIndex: z.number().int().min(0),
      semanticType: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    }),
  ),
})

export type HeaderAnalysis = z.infer<typeof headerAnalysisSchema>

// ------------------------------------------------------------
// 2. 発言の案件単位分割
// ------------------------------------------------------------
export const splitJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['blocks'],
  properties: {
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['originalText'],
        properties: {
          originalText: { type: 'string' },
        },
      },
    },
  },
} as const

export const splitSchema = z.object({
  blocks: z.array(z.object({ originalText: z.string() })),
})

export type SplitResult = z.infer<typeof splitSchema>

// ------------------------------------------------------------
// 3. 案件マッチング + 更新候補（1 ブロック分）
// ------------------------------------------------------------
export const blockAnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['matchedCandidateId', 'confidence', 'reason', 'updates'],
  properties: {
    // 候補リストで提示した ID。特定できない場合は空文字を返させます。
    matchedCandidateId: { type: 'string' },
    confidence: { type: 'number' },
    reason: { type: 'string' },
    updates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['semanticType', 'value', 'confidence'],
        properties: {
          semanticType: { type: 'string' },
          value: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
  },
} as const

export const blockAnalysisSchema = z.object({
  matchedCandidateId: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  updates: z.array(
    z.object({
      semanticType: z.string(),
      value: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

export type BlockAnalysis = z.infer<typeof blockAnalysisSchema>
