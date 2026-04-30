'use client';

import React, { useMemo, useState } from 'react';
import { DEFAULT_PAGE_SETTINGS, HwpDocumentModel, PageSettings, Paragraph } from '../types/document';

interface HwpInspectorPanelProps {
  model: HwpDocumentModel;
  onModelChange: (model: HwpDocumentModel) => void;
}

type InspectorTab = 'structure' | 'tables' | 'fields' | 'numbering' | 'bullets' | 'headers';
type ControlEntry = NonNullable<Paragraph['controls']>[number];

function pageSetupToPageSettings(pageSetup?: Record<string, number>): PageSettings {
  return {
    ...DEFAULT_PAGE_SETTINGS,
    widthMm: pageSetup?.paperWidth,
    heightMm: pageSetup?.paperHeight,
    margins: {
      ...DEFAULT_PAGE_SETTINGS.margins,
      top: pageSetup?.topMargin ?? DEFAULT_PAGE_SETTINGS.margins.top,
      bottom: pageSetup?.bottomMargin ?? DEFAULT_PAGE_SETTINGS.margins.bottom,
      left: pageSetup?.leftMargin ?? DEFAULT_PAGE_SETTINGS.margins.left,
      right: pageSetup?.rightMargin ?? DEFAULT_PAGE_SETTINGS.margins.right,
      header: pageSetup?.headerMargin ?? DEFAULT_PAGE_SETTINGS.margins.header,
      footer: pageSetup?.footerMargin ?? DEFAULT_PAGE_SETTINGS.margins.footer,
      gutter: pageSetup?.gutterMargin ?? DEFAULT_PAGE_SETTINGS.margins.gutter,
    },
  };
}

function pageSettingsToPageSetup(pageSettings: PageSettings): Record<string, number> {
  const margins = pageSettings.margins;
  const setup: Record<string, number> = {};
  if (typeof pageSettings.widthMm === 'number') setup.paperWidth = pageSettings.widthMm;
  if (typeof pageSettings.heightMm === 'number') setup.paperHeight = pageSettings.heightMm;
  setup.leftMargin = margins.left;
  setup.rightMargin = margins.right;
  setup.topMargin = margins.top;
  setup.bottomMargin = margins.bottom;
  setup.headerMargin = margins.header ?? 0;
  setup.footerMargin = margins.footer ?? 0;
  setup.gutterMargin = margins.gutter ?? 0;
  return setup;
}

function syncHwpPageSettings(draft: HwpDocumentModel, pageSettings: PageSettings) {
  draft.pageSettings = pageSettings;
  if (!draft.sections.length) return;
  draft.sections[0] = {
    ...draft.sections[0],
    pageSetup: pageSettingsToPageSetup(pageSettings),
  };
}

function cloneModel(model: HwpDocumentModel): HwpDocumentModel {
  return JSON.parse(JSON.stringify(model)) as HwpDocumentModel;
}

function getParagraphLabel(paragraph: Paragraph) {
  const preview = (paragraph.text || '').trim();
  if (!preview) return '(빈 문단)';
  return preview.length > 36 ? `${preview.slice(0, 36)}...` : preview;
}

function getControlType(control: ControlEntry) {
  return String(control?.type || 'UNKNOWN').toUpperCase();
}

export default function HwpInspectorPanel({ model, onModelChange }: HwpInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('structure');

  const controlItems = useMemo(() => {
    const items: Array<{
      sectionIndex: number;
      paragraphIndex: number;
      controlIndex: number;
      control: ControlEntry;
      paragraphText: string;
    }> = [];

    model.sections.forEach((section, sectionIndex) => {
      section.paragraphs.forEach((paragraph, paragraphIndex) => {
        (paragraph.controls ?? []).forEach((control, controlIndex) => {
          items.push({
            sectionIndex,
            paragraphIndex,
            controlIndex,
            control,
            paragraphText: paragraph.text || '',
          });
        });
      });
    });

    return items;
  }, [model.sections]);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of controlItems) {
      const type = getControlType(item.control);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return counts;
  }, [controlItems]);

  const updateModel = (mutator: (draft: HwpDocumentModel) => void) => {
    const draft = cloneModel(model);
    mutator(draft);
    onModelChange(draft);
  };

  const updateParagraph = (sectionIndex: number, paragraphIndex: number, updater: (paragraph: Paragraph) => void) => {
    updateModel((draft) => {
      const paragraph = draft.sections[sectionIndex]?.paragraphs[paragraphIndex];
      if (!paragraph) return;
      updater(paragraph);
    });
  };

  const updateControlMeta = (
    sectionIndex: number,
    paragraphIndex: number,
    controlIndex: number,
    key: 'label' | 'note',
    value: string,
  ) => {
    updateParagraph(sectionIndex, paragraphIndex, (paragraph) => {
      const control = paragraph.controls?.[controlIndex];
      if (!control) return;
      control.extended = { ...(control.extended || {}), [key]: value };
    });
  };

  const applyParagraphListType = (listType: Paragraph['listType']) => {
    updateModel((draft) => {
      for (const section of draft.sections) {
        for (const paragraph of section.paragraphs) {
          paragraph.listType = listType;
        }
      }
    });
  };

  const currentPageSettings = model.pageSettings ?? pageSetupToPageSettings(model.sections[0]?.pageSetup);

  return (
    <section style={{
      marginBottom: '12px',
      padding: '16px',
      borderRadius: '16px',
      border: '1px solid rgba(122,162,247,0.28)',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(15,23,42,0.92))',
      color: '#e2e8f0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#7aa2f7', fontWeight: 700 }}>HWP 편집 패널</div>
          <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '4px' }}>
            표, 필드, 번호매기기, 글머리표, 머리말·꼬리말을 문서 구조 기준으로 직접 조작합니다.
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(['structure', 'tables', 'fields', 'numbering', 'bullets', 'headers'] as InspectorTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 10px',
                borderRadius: '999px',
                border: activeTab === tab ? '1px solid rgba(122,162,247,0.65)' : '1px solid rgba(255,255,255,0.12)',
                background: activeTab === tab ? 'rgba(122,162,247,0.18)' : 'rgba(255,255,255,0.04)',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {tab === 'structure' && '구조'}
              {tab === 'tables' && '표'}
              {tab === 'fields' && '필드'}
              {tab === 'numbering' && '번호매기기'}
              {tab === 'bullets' && '글머리표'}
              {tab === 'headers' && '머리말/꼬리말'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'structure' && (
        <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          {[
            ['섹션', model.sections.length],
            ['문단', model.sections.reduce((sum, section) => sum + section.paragraphs.length, 0)],
            ['컨트롤', controlItems.length],
            ['글꼴', model.docInfo?.hangulFaceNames?.length ?? 0],
            ['문자서식', model.docInfo?.charShapes?.length ?? 0],
            ['문단서식', model.docInfo?.paraShapes?.length ?? 0],
            ['번호', model.docInfo?.numberings?.length ?? 0],
            ['글머리표', model.docInfo?.bullets?.length ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{label as string}</div>
              <div style={{ marginTop: '6px', fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>{value as number}</div>
            </div>
          ))}
          {Array.from(summary.entries()).length > 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>컨트롤 종류</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Array.from(summary.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([type, count]) => (
                  <span key={type} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '4px 8px', borderRadius: '999px',
                    background: 'rgba(122,162,247,0.14)', border: '1px solid rgba(122,162,247,0.28)',
                    fontSize: '11px',
                  }}>
                    <strong style={{ color: '#7aa2f7' }}>{type}</strong>
                    <span>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tables' && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>표 컨트롤 목록</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{controlItems.filter((item) => getControlType(item.control) === 'TABLE').length}개</div>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {controlItems.filter((item) => getControlType(item.control) === 'TABLE').map((item) => (
              <div key={`${item.sectionIndex}-${item.paragraphIndex}-${item.controlIndex}`} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>섹션 {item.sectionIndex + 1}, 문단 {item.paragraphIndex + 1}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{getParagraphLabel({ text: item.paragraphText })}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7aa2f7' }}>{String(item.control.ctrlId ?? '')}</div>
                </div>
                <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
                  <label style={{ display: 'grid', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                    표 표시 이름
                    <input
                      value={String(item.control.extended?.label ?? '')}
                      onChange={(e) => updateControlMeta(item.sectionIndex, item.paragraphIndex, item.controlIndex, 'label', e.target.value)}
                      placeholder="예: 표 1"
                      style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.9)', color: '#fff' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                    메모
                    <input
                      value={String(item.control.extended?.note ?? '')}
                      onChange={(e) => updateControlMeta(item.sectionIndex, item.paragraphIndex, item.controlIndex, 'note', e.target.value)}
                      placeholder="표 설명 또는 연결 정보"
                      style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.9)', color: '#fff' }}
                    />
                  </label>
                </div>
              </div>
            ))}
            {controlItems.filter((item) => getControlType(item.control) === 'TABLE').length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>이 문서에서 표 컨트롤이 감지되지 않았습니다.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'fields' && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>필드 컨트롤 목록</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{controlItems.filter((item) => item.control.isField || getControlType(item.control).startsWith('FIELD_')).length}개</div>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {controlItems.filter((item) => item.control.isField || getControlType(item.control).startsWith('FIELD_')).map((item) => (
              <div key={`${item.sectionIndex}-${item.paragraphIndex}-${item.controlIndex}`} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>섹션 {item.sectionIndex + 1}, 문단 {item.paragraphIndex + 1}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{getControlType(item.control)}</div>
                <div style={{ marginTop: '8px', display: 'grid', gap: '8px' }}>
                  <label style={{ display: 'grid', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                    필드 표시 이름
                    <input
                      value={String(item.control.extended?.label ?? '')}
                      onChange={(e) => updateControlMeta(item.sectionIndex, item.paragraphIndex, item.controlIndex, 'label', e.target.value)}
                      placeholder="예: 날짜, 작성자, 제목"
                      style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.9)', color: '#fff' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                    필드 메모
                    <input
                      value={String(item.control.extended?.note ?? '')}
                      onChange={(e) => updateControlMeta(item.sectionIndex, item.paragraphIndex, item.controlIndex, 'note', e.target.value)}
                      placeholder="필드 원본값 또는 표시 규칙"
                      style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.9)', color: '#fff' }}
                    />
                  </label>
                </div>
              </div>
            ))}
            {controlItems.filter((item) => item.control.isField || getControlType(item.control).startsWith('FIELD_')).length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>이 문서에서 필드가 감지되지 않았습니다.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'numbering' && (
        <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>문단 번호/글머리표</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button onClick={() => applyParagraphListType('number')} style={actionButtonStyle}>전체 번호매기기</button>
              <button onClick={() => applyParagraphListType('bullet')} style={actionButtonStyle}>전체 글머리표</button>
              <button onClick={() => applyParagraphListType('none')} style={actionButtonStyle}>전체 해제</button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {(model.docInfo?.numberings ?? []).map((numbering, index) => (
              <div key={`numbering-${index}`} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>번호 서식 {index + 1}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>시작 번호 {numbering.startNumber ?? 1}</div>
                </div>
                <div style={{ fontSize: '11px', color: '#7aa2f7' }}>{numbering.levels ?? 0}개 레벨</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: '8px', maxHeight: '380px', overflow: 'auto', paddingRight: '4px' }}>
            {model.sections.flatMap((section, sectionIndex) => section.paragraphs.map((paragraph, paragraphIndex) => ({ sectionIndex, paragraphIndex, paragraph }))).map(({ sectionIndex, paragraphIndex, paragraph }) => (
              <div key={`${sectionIndex}-${paragraphIndex}`} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>섹션 {sectionIndex + 1}, 문단 {paragraphIndex + 1}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{getParagraphLabel(paragraph)}</div>
                  </div>
                  <select
                    value={paragraph.listType ?? 'none'}
                    onChange={(e) => updateParagraph(sectionIndex, paragraphIndex, (draft) => { draft.listType = e.target.value as Paragraph['listType']; })}
                    style={{ padding: '8px 10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.9)', color: '#fff' }}
                  >
                    <option value="none">없음</option>
                    <option value="bullet">글머리표</option>
                    <option value="number">번호매기기</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'bullets' && (
        <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>문단 글머리표와 HWP bullet catalog</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button onClick={() => applyParagraphListType('bullet')} style={actionButtonStyle}>글머리표 적용</button>
              <button onClick={() => applyParagraphListType('none')} style={actionButtonStyle}>해제</button>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {(model.docInfo?.bullets ?? []).map((bullet, index) => (
              <div key={`bullet-${index}`} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>글머리표 {index + 1}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      문자 {bullet.bulletChar ?? '—'} · 체크 {bullet.checkBulletChar ?? '—'}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#7aa2f7' }}>
                    {bullet.imageBullet ? '이미지 글머리표' : '문자 글머리표'}
                  </div>
                </div>
              </div>
            ))}
            {(model.docInfo?.bullets ?? []).length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>이 문서에서 글머리표 catalog가 감지되지 않았습니다.</div>
            )}
          </div>
          <div style={{ display: 'grid', gap: '8px', maxHeight: '320px', overflow: 'auto', paddingRight: '4px' }}>
            {model.sections.flatMap((section, sectionIndex) => section.paragraphs.map((paragraph, paragraphIndex) => ({ sectionIndex, paragraphIndex, paragraph }))).filter(({ paragraph }) => paragraph.listType === 'bullet').map(({ sectionIndex, paragraphIndex, paragraph }) => (
              <div key={`bullet-paragraph-${sectionIndex}-${paragraphIndex}`} style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>섹션 {sectionIndex + 1}, 문단 {paragraphIndex + 1}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{getParagraphLabel(paragraph)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'headers' && (
        <div style={{ marginTop: '14px', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <label style={{ display: 'grid', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
              머리말 텍스트
              <input
                value={currentPageSettings.headerText ?? ''}
                onChange={(e) => updateModel((draft) => {
                  syncHwpPageSettings(draft, { ...currentPageSettings, headerText: e.target.value });
                })}
                placeholder="예: 문서 제목"
                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.9)', color: '#fff' }}
              />
            </label>
            <label style={{ display: 'grid', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
              꼬리말 텍스트
              <input
                value={currentPageSettings.footerText ?? ''}
                onChange={(e) => updateModel((draft) => {
                  syncHwpPageSettings(draft, { ...currentPageSettings, footerText: e.target.value });
                })}
                placeholder="예: 페이지 번호 / 회사명"
                style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.9)', color: '#fff' }}
              />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {[
              ['상단', 'top'],
              ['하단', 'bottom'],
              ['좌측', 'left'],
              ['우측', 'right'],
            ].map(([label, key]) => (
              <label key={key} style={{ display: 'grid', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                {label} 여백
                <input
                  type="number"
                  value={((currentPageSettings.margins as unknown as Record<string, number>)[key]) ?? 0}
                  onChange={(e) => updateModel((draft) => {
                    const nextSettings: PageSettings = {
                      ...currentPageSettings,
                      margins: {
                        ...currentPageSettings.margins,
                        [key]: Number(e.target.value),
                      },
                    };
                    syncHwpPageSettings(draft, nextSettings);
                  })}
                  style={{ padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(15,23,42,0.9)', color: '#fff' }}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const actionButtonStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: '12px',
};
