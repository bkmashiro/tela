/**
 * Extractor types for converting arbitrary HTML into Tela documents.
 */

export interface ExtractedSection {
  tela: string;        // .tela fragment for this section
  confidence: number;  // 0.0-1.0
  notes: string[];     // e.g. "layout: detected flex row → split(50/50)"
}

export interface ExtractionResult {
  tela: string;                    // full .tela document
  sections: ExtractedSection[];
  overallConfidence: number;
  warnings: string[];
}
