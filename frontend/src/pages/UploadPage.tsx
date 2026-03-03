import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  X,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Header } from '../components/layout/Header';
import { Button } from '../components/shared/Button';
import { Badge } from '../components/shared/Badge';
import {
  uploadApi,
  type UploadPreview,
  type DiffResult,
  type DiffNode,
  type UpsertResult,
} from '../api/uploadApi';

type Step = 'upload' | 'preview' | 'diff' | 'result';

export const UploadPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [result, setResult] = useState<UpsertResult | null>(null);

  const handleFile = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const previewData = await uploadApi.preview(selectedFile);
      setPreview(previewData);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일 파싱에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFile(selectedFile);
    },
    [handleFile]
  );

  const handleDiff = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const diffData = await uploadApi.diff(file);
      setDiff(diffData);
      setStep('diff');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DB 비교에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const handleConfirm = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const upsertResult = await uploadApi.confirm(file);
      setResult(upsertResult);
      setStep('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DB 반영에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [file]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setDiff(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header title="엑셀 업로드" subtitle="엑셀 파일로 PI 과제를 일괄 등록합니다" />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(['upload', 'preview', 'diff', 'result'] as Step[]).map((s, i) => {
            const labels = ['파일 선택', '미리보기', 'DB 비교', '결과'];
            const isActive = s === step;
            const isDone =
              (s === 'upload' && step !== 'upload') ||
              (s === 'preview' && (step === 'diff' || step === 'result')) ||
              (s === 'diff' && step === 'result');

            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight size={16} className="text-gray-300" />}
                <span
                  className={clsx(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    isActive && 'bg-[#7952B3] text-white',
                    isDone && 'bg-green-100 text-green-700',
                    !isActive && !isDone && 'bg-gray-100 text-gray-400'
                  )}
                >
                  {labels[i]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Step 1: File Upload */}
        {step === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                dragOver
                  ? 'border-[#7952B3] bg-[#7952B3]/5'
                  : 'border-gray-300 hover:border-[#7952B3] hover:bg-gray-50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-[#7952B3] border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-500">파일을 분석하고 있습니다...</p>
                </div>
              ) : (
                <>
                  <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    엑셀 파일을 드래그하거나 클릭하여 선택하세요
                  </p>
                  <p className="text-sm text-gray-400">
                    .xlsx, .xls 파일만 지원 (최대 10MB)
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div>
            {/* File info */}
            <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
              <FileSpreadsheet size={20} className="text-green-600" />
              <span className="text-sm font-medium text-gray-700">{file?.name}</span>
              <span className="text-sm text-gray-400">
                ({(file?.size ? file.size / 1024 : 0).toFixed(1)} KB)
              </span>
            </div>

            {/* Summary badges */}
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="primary" size="md">L1: {preview.summary.l1_count}개</Badge>
              <Badge variant="primary" size="md">L2: {preview.summary.l2_count}개</Badge>
              <Badge variant="primary" size="md">L3: {preview.summary.l3_count}개</Badge>
              <Badge variant="primary" size="md">L4: {preview.summary.l4_count}개</Badge>
            </div>

            {/* Preview table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">#</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">L1</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">L2</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">L3</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">L4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2.5 px-4 text-sm text-gray-400">{i + 1}</td>
                        <td className="py-2.5 px-4 text-sm text-gray-700">{row.l1}</td>
                        <td className="py-2.5 px-4 text-sm text-gray-700">{row.l2}</td>
                        <td className="py-2.5 px-4 text-sm text-gray-700">{row.l3}</td>
                        <td className="py-2.5 px-4 text-sm text-gray-900 font-medium">{row.l4}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.total_rows > 10 && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
                  총 {preview.total_rows}개 행 중 10개 표시
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                icon={ArrowRight}
                iconPosition="right"
                onClick={handleDiff}
                loading={loading}
              >
                다음: DB 비교
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                취소
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Diff */}
        {step === 'diff' && diff && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{diff.stats.new}</p>
                <p className="text-sm text-gray-500">신규 추가</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-gray-500">{diff.stats.existing}</p>
                <p className="text-sm text-gray-500">기존 (건너뜀)</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
                <p className="text-2xl font-bold text-[#7952B3]">{diff.stats.total}</p>
                <p className="text-sm text-gray-500">전체</p>
              </div>
            </div>

            {/* Diff tree */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">변경사항 미리보기</h3>
              <div className="space-y-1">
                {diff.diff_tree.map((node, i) => (
                  <DiffTreeNode key={i} node={node} depth={0} />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleConfirm} loading={loading}>
                DB에 반영하기
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                취소
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && result && (
          <div className="max-w-lg mx-auto text-center">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
              <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">업로드 완료</h2>
              <p className="text-gray-500 mb-6">엑셀 데이터가 성공적으로 DB에 반영되었습니다.</p>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">{result.created}</p>
                  <p className="text-xs text-green-700">생성</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-500">{result.skipped}</p>
                  <p className="text-xs text-gray-600">건너뜀</p>
                </div>
                <div className="bg-[#7952B3]/10 rounded-lg p-3">
                  <p className="text-2xl font-bold text-[#7952B3]">{result.total}</p>
                  <p className="text-xs text-[#5E3D8F]">전체</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="primary"
                  icon={ArrowRight}
                  iconPosition="right"
                  onClick={() => navigate('/graph')}
                >
                  그래프 보기
                </Button>
                <Button variant="secondary" onClick={handleReset}>
                  다시 업로드
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Diff Tree Node (재귀 컴포넌트) ─── */

const DiffTreeNode = ({ node, depth }: { node: DiffNode; depth: number }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        <span className="text-xs font-mono text-gray-400 w-6">{node.level}</span>
        <span className="text-sm text-gray-800 truncate">{node.name}</span>

        {node.status === 'new' ? (
          <Badge variant="success" size="sm">신규</Badge>
        ) : (
          <Badge variant="default" size="sm">기존</Badge>
        )}
      </div>

      {expanded &&
        hasChildren &&
        node.children.map((child, i) => (
          <DiffTreeNode key={i} node={child} depth={depth + 1} />
        ))}
    </div>
  );
};
