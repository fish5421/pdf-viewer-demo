# PDF Viewer with Annotations - Demo Project

This is a working example of a PDF viewer with annotation capabilities built using **EmbedPDF** and **React**. This project was created to accompany the step-by-step setup guide for Mac M1 Pro.

## Features

✅ **PDF Rendering**: Displays PDF documents with smooth scrolling
✅ **Annotations**: Full annotation support including:
  - Highlighting
  - Pen/Ink drawing
  - Shapes (squares, circles)
  - Text annotations
✅ **Interactive Toolbar**: Easy-to-use toolbar for selecting annotation tools
✅ **Delete Functionality**: Select and delete annotations
✅ **Undo/Redo**: History support for annotation changes

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **EmbedPDF** for PDF rendering and annotations
- **PDFium** rendering engine

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)
- **Mac M1 Pro** (or any modern Mac/PC)

## Installation

1. **Clone or download this project**

2. **Install dependencies**:
   ```bash
   npm install
   ```

## Running the Application

To start the development server:

```bash
npm run dev
```

This will start the Vite development server. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

## Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist/` directory.

To preview the production build locally:

```bash
npm run preview
```

## Project Structure

```
pdf-viewer-demo/
├── src/
│   ├── components/
│   │   ├── PDFViewer.tsx          # Main PDF viewer component
│   │   └── AnnotationToolbar.tsx  # Annotation toolbar component
│   ├── App.tsx                     # Root application component
│   ├── main.tsx                    # Application entry point
│   └── index.css                   # Global styles
├── package.json                    # Project dependencies
└── README.md                       # This file
```

## How to Use

1. **View PDF**: The application loads a sample PDF automatically
2. **Select Tool**: Click on any tool in the toolbar (Highlight, Pen, Square, Circle, Text)
3. **Create Annotation**: 
   - For highlighting: Select text with your mouse
   - For pen: Click and drag to draw
   - For shapes: Click and drag to create the shape
   - For text: Click where you want to add text
4. **Delete Annotation**: Select an annotation by clicking on it, then click the Delete button

## Customization

### Change the PDF Source

Edit `src/components/PDFViewer.tsx` and modify the `LoaderPluginPackage` configuration:

```typescript
createPluginRegistration(LoaderPluginPackage, {
  loadingOptions: {
    type: 'url',
    pdfFile: {
      id: 'my-pdf',
      url: 'YOUR_PDF_URL_HERE',
    },
  },
}),
```

### Add More Annotation Tools

The annotation plugin supports many tools. Add more to the toolbar in `src/components/AnnotationToolbar.tsx`:

Available tools:
- `highlight` - Text highlighter
- `underline` - Text underline
- `strikeout` - Text strikeout
- `squiggly` - Squiggly underline
- `ink` - Free-hand pen
- `inkHighlighter` - Free-hand highlighter
- `circle` - Circle/ellipse
- `square` - Rectangle
- `line` - Straight line
- `lineArrow` - Line with arrow
- `polyline` - Multi-segment line
- `polygon` - Multi-sided shape
- `freeText` - Text box
- `stamp` - Image stamp

### Styling

Modify the inline styles in the components or create separate CSS files for more complex styling.

## Next Steps: Adding LLM Integration

To add AI-powered features like document Q&A:

1. **Extract Text**: Use EmbedPDF's selection API to get text from the PDF
2. **Backend Service**: Create a Node.js/Python backend to handle LLM API calls
3. **Vector Database**: Store document chunks in a vector DB (Pinecone, Weaviate, ChromaDB)
4. **RAG Pipeline**: Use LangChain or LlamaIndex for retrieval-augmented generation
5. **Chat UI**: Add a chat interface component to your React app

## Troubleshooting

### Port Already in Use

If port 5173 is already in use, Vite will automatically try the next available port. Check the terminal output for the actual URL.

### Build Warnings

The build may show warnings about chunk sizes. This is normal for PDF libraries which include large WASM files. You can ignore these warnings for development.

### TypeScript Errors

Make sure all dependencies are installed correctly:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Resources

- [EmbedPDF Documentation](https://www.embedpdf.com/docs)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## License

This demo project is provided as-is for educational purposes. EmbedPDF is MIT licensed.

---

**Created by**: Manus AI
**Date**: December 06, 2025
