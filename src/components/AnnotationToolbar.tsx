import { useState, useEffect } from 'react';
import { useAnnotationCapability } from '@embedpdf/plugin-annotation/react';

export const AnnotationToolbar = () => {
  const { provides: annotationApi } = useAnnotationCapability();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    if (!annotationApi) return;
    
    // Listen for selection changes
    const unsubscribe = annotationApi.onStateChange((state) => {
      setHasSelection(!!state.selectedUid);
    });

    return unsubscribe;
  }, [annotationApi]);

  const tools = [
    { id: 'highlight', name: '🖍️ Highlight', color: '#FFD700' },
    { id: 'ink', name: '✏️ Pen', color: '#000000' },
    { id: 'square', name: '⬜ Square', color: '#FF6B6B' },
    { id: 'circle', name: '⭕ Circle', color: '#4ECDC4' },
    { id: 'freeText', name: '📝 Text', color: '#95E1D3' },
  ];

  const handleToolClick = (toolId: string) => {
    annotationApi?.setActiveTool(toolId);
    setActiveTool(toolId);
  };

  const handleDelete = () => {
    const selection = annotationApi?.getSelectedAnnotation();
    if (selection) {
      annotationApi?.deleteAnnotation(selection.object.pageIndex, selection.object.id);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'white',
      padding: '0.75rem 1.5rem',
      borderRadius: '0.75rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      zIndex: 100,
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
    }}>
      <div style={{ 
        fontSize: '0.875rem', 
        fontWeight: 'bold', 
        marginRight: '0.5rem',
        color: '#333',
      }}>
        Annotation Tools:
      </div>
      {tools.map(tool => (
        <button 
          key={tool.id} 
          onClick={() => handleToolClick(tool.id)}
          style={{
            padding: '0.5rem 1rem',
            border: activeTool === tool.id ? '2px solid #4CAF50' : '1px solid #ddd',
            borderRadius: '0.5rem',
            backgroundColor: activeTool === tool.id ? '#E8F5E9' : 'white',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: activeTool === tool.id ? 'bold' : 'normal',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (activeTool !== tool.id) {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTool !== tool.id) {
              e.currentTarget.style.backgroundColor = 'white';
            }
          }}
        >
          {tool.name}
        </button>
      ))}
      <div style={{ width: '1px', height: '2rem', backgroundColor: '#ddd', margin: '0 0.5rem' }} />
      <button 
        onClick={handleDelete}
        disabled={!hasSelection}
        style={{
          padding: '0.5rem 1rem',
          border: '1px solid #ddd',
          borderRadius: '0.5rem',
          backgroundColor: hasSelection ? '#FFEBEE' : '#f5f5f5',
          cursor: hasSelection ? 'pointer' : 'not-allowed',
          fontSize: '0.875rem',
          color: hasSelection ? '#D32F2F' : '#999',
          fontWeight: hasSelection ? 'bold' : 'normal',
          transition: 'all 0.2s',
        }}
      >
        🗑️ Delete
      </button>
    </div>
  );
};
