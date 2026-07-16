import React, { useRef, useState, useEffect } from 'react';
import '../styles/RichTextEditor.css';

function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
  });

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateFormatStates();
  };

  const updateFormatStates = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
    });
  };

  const handleInput = () => {
    onChange(editorRef.current.innerHTML);
  };

  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          execCommand('insertHTML', `<img src="${event.target.result}" style="max-width: 100%; height: auto; margin: 5px 0;" />`);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const insertLink = () => {
    const url = prompt('Nhập URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const changeTextColor = (e) => {
    execCommand('foreColor', e.target.value);
  };

  const changeBackgroundColor = (e) => {
    execCommand('hiliteColor', e.target.value);
  };

  return (
    <div className="rich-text-editor-container">
      <div className="rte-toolbar">
        <button
          type="button"
          className={`rte-btn ${activeFormats.bold ? 'active' : ''}`}
          onClick={() => execCommand('bold')}
          title="Đậm (Ctrl+B)"
        >
          <strong>B</strong>
        </button>

        <button
          type="button"
          className={`rte-btn ${activeFormats.italic ? 'active' : ''}`}
          onClick={() => execCommand('italic')}
          title="Nghiêng (Ctrl+I)"
        >
          <em>I</em>
        </button>

        <button
          type="button"
          className={`rte-btn ${activeFormats.underline ? 'active' : ''}`}
          onClick={() => execCommand('underline')}
          title="Gạch chân (Ctrl+U)"
        >
          <u>U</u>
        </button>

        <button
          type="button"
          className={`rte-btn ${activeFormats.strikeThrough ? 'active' : ''}`}
          onClick={() => execCommand('strikeThrough')}
          title="Gạch ngang"
        >
          <s>S</s>
        </button>

        <div className="rte-separator"></div>

        <button
          type="button"
          className="rte-btn"
          onClick={() => execCommand('insertOrderedList')}
          title="Danh sách đánh số"
        >
          1. ≡
        </button>

        <button
          type="button"
          className="rte-btn"
          onClick={() => execCommand('insertUnorderedList')}
          title="Danh sách gạch đầu dòng"
        >
          • ≡
        </button>

        <div className="rte-separator"></div>

        <button
          type="button"
          className="rte-btn"
          onClick={() => execCommand('justifyLeft')}
          title="Căn trái"
        >
          ☰
        </button>

        <button
          type="button"
          className="rte-btn"
          onClick={() => execCommand('justifyCenter')}
          title="Căn giữa"
        >
          ☱
        </button>

        <button
          type="button"
          className="rte-btn"
          onClick={() => execCommand('justifyRight')}
          title="Căn phải"
        >
          ☲
        </button>

        <div className="rte-separator"></div>

        <button
          type="button"
          className="rte-btn"
          onClick={insertLink}
          title="Chèn link"
        >
          🔗
        </button>

        <button
          type="button"
          className="rte-btn"
          onClick={insertImage}
          title="Chèn ảnh"
        >
          🖼️
        </button>

        <div className="rte-separator"></div>

        <label className="rte-color-picker" title="Màu chữ">
          <span>A</span>
          <input
            type="color"
            onChange={changeTextColor}
            defaultValue="#000000"
          />
        </label>

        <label className="rte-color-picker" title="Màu nền">
          <span style={{ backgroundColor: '#ffff00', padding: '2px 4px' }}>A</span>
          <input
            type="color"
            onChange={changeBackgroundColor}
            defaultValue="#ffff00"
          />
        </label>

        <div className="rte-separator"></div>

        <button
          type="button"
          className="rte-btn"
          onClick={() => execCommand('removeFormat')}
          title="Xóa định dạng"
        >
          🧹
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        className="rte-content"
        onInput={handleInput}
        onMouseUp={updateFormatStates}
        onKeyUp={updateFormatStates}
        suppressContentEditableWarning
        data-placeholder={placeholder}
      />
    </div>
  );
}

export default RichTextEditor;
