import { useState, useRef } from 'react';

interface Props {
  onFileSelected: (file: File, text?: string) => void;
  accept?: string;
  currentFileName?: string;
}

export function FileUploadZone({ onFileSelected, accept = '.pdf,.docx,.doc,.txt,.jpg,.png', currentFileName }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(currentFileName || '');
  const [fileSize, setFileSize] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onFileSelected(file, e.target?.result as string);
      };
      reader.readAsText(file);
    } else {
      onFileSelected(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
        dragOver ? 'border-leap-blue bg-blue-50' : fileName ? 'border-green-300 bg-green-50/30' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {fileName ? (
        <div>
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm font-bold text-gray-900">{fileName}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{fileSize}</p>
          <p className="text-[11px] text-green-600 mt-2 font-medium">File uploaded successfully</p>
          <button
            onClick={(e) => { e.stopPropagation(); setFileName(''); setFileSize(''); }}
            className="text-[11px] text-gray-400 hover:text-gray-600 mt-1"
          >
            Remove & upload another
          </button>
        </div>
      ) : (
        <div>
          <div className="text-3xl mb-2">{dragOver ? '📥' : '📤'}</div>
          <p className="text-sm font-medium text-gray-700">
            {dragOver ? 'Drop your file here' : 'Drag & drop your syllabus file'}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">PDF, Word, Text, or Image files accepted</p>
          <button
            className="btn-secondary text-[11px] mt-3 py-1.5"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          >
            Browse Files
          </button>
        </div>
      )}
    </div>
  );
}
