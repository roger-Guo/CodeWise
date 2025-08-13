# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environment

### Prerequisites
- **Node.js**: 20.19.3
- **Python**: 3.13.5 
- **Environment Management**: miniconda with virtual environment named `codewise`
- **Activate Environment**: `conda activate codewise`

### Technology Stack
- **Backend**: Python 3.13.5 + FastAPI
- **Frontend**: React 18 + Vite + Ant Design React + TypeScript
- **LLM**: deepseek-coder-v2 (local deployment)
- **Vector Database**: chroma_db
- **Embedding Model**: BAAI/bge-m3 (Chinese optimized)
- **RAG Framework**: LlamaIndex + LangGraph
- **Code Parsing**: @babel/parser, @babel/traverse, @babel/types, @babel/preset-react

## Key Commands

### Parser (Code Knowledge Graph Builder)
```bash
# Navigate to parser directory
cd parser

# Install dependencies
npm install

# Parse single file or test
node test.js

# Parse entire project with CLI
node project-parser.js
node project-parser.js ./src
node project-parser.js -o ./results
node project-parser.js --pattern "src/**/*.{jsx,tsx}"

# Parse ant-design-pro test project
node project-parser.js ./source-projects/ant-design-pro
```

### Testing and Development
```bash
# Run parser tests
cd parser && npm test

# Debug mode for parser
DEBUG=* node project-parser.js
```

## High-Level Architecture

### Core Components

#### 1. Parser Module (`parser/`)
The **code knowledge graph parser** is the foundation of the system. It transforms source code into structured JSON knowledge nodes.

**Key Features:**
- **Bidirectional Dependency Graph**: Builds both forward references (what I depend on) and backward references (who depends on me)
- **Two-tier Output Architecture**: Generates modular JSON files for each definition (components, functions, classes)
- **React Deep Analysis**: Extracts Props, State, Hooks, and nested component definitions
- **Path Resolution**: Handles alias paths (@/, ../) and absolute/relative imports
- **Metadata Extraction**: Git version, branch, file timestamps, etc.

**Core Commands:**
- `node project-parser.js` - Parse entire project
- `node test.js` - Parse test files

#### 2. RAG Service (`rag/`)
Python FastAPI service providing vector search and retrieval capabilities.

#### 3. Agent Service (`agent/`)
LangGraph-based agent service implementing multi-file code analysis workflow:

**Agent Workflow:**
1. **Retrieve**: Vector search for relevant entry files
2. **Analyze**: Load file JSON, examine dependencies, build context
3. **Router**: Check if more files need analysis (dependency traversal)
4. **Generate**: Synthesize complete cross-file context for LLM

#### 4. Data Pipeline
- **Source**: `data/source/` - Raw source code projects
- **Target**: `data/target/` - Processed projects  
- **Output**: `parser/output/` - Generated knowledge graph JSON files

### Project Structure
```
CodeWise/
├── parser/            # Code knowledge graph parser (Node.js)
├── rag/               # Python FastAPI RAG service
├── agent/             # Python LangGraph Agent service  
├── data/              # Source code and processed JSON files
├── output/            # Parser output files
├── models/            # Local embedding model storage
├── db/                # chroma_db vector database
└── scripts/           # Deployment scripts
```

### Knowledge Graph Structure

Each parsed file becomes a knowledge node with:

```json
{
  "fileMetadata": {
    "filePath": "src/components/UserProfile.jsx",
    "version": "a1b2c3d",
    "branch": "main"
  },
  "fileDefinitions": [
    {
      "name": "UserProfile", 
      "definitionType": "component",
      "scopePath": null,
      "qualifiedName": "UserProfile.jsx::UserProfile"
    }
  ],
  "dependencyInfo": {
    "forwardReferences": [
      { "function": "fetchFromApi", "source": "../api/user" }
    ],
    "backwardReferences": [
      { "referencedBy": "src/pages/HomePage.jsx" }
    ]
  }
}
```

## Development Guidelines

### Code Quality Standards
- **Python**: Follow PEP 8, use type hints, async/await patterns
- **React**: Use React Hooks, functional components, TypeScript interfaces
- **Documentation**: Chinese comments and documentation
- **Path Safety**: Prevent path traversal attacks in file operations

### Parser Development
- Maintain source code integrity during parsing
- Record accurate line numbers and position information
- Support React JSX/TSX, JavaScript, TypeScript files
- Handle both alias paths (@/) and relative paths (../)
- Generate bidirectional dependency relationships

### RAG/Agent Development
- **Chinese Optimization**: Vector processing optimized for Chinese text
- **Context Preservation**: Maintain cross-file context completeness
- **LangGraph Integration**: Implement Retrieve->Analyze->Router->Generate workflow
- **State Management**: Track global context, visited files, call chains
- **Dependency Traversal**: Use knowledge graph for intelligent file discovery

### Testing Projects
- **ant-design-pro**: Large-scale React project for testing parser capabilities
- **Test files**: Located in `parser/test-files/` and `test-files/`

## Common Patterns

### Adding New File Types
1. Extend parser to handle new syntax patterns
2. Update file matching patterns in project-parser.js
3. Add corresponding AST traversal logic
4. Update knowledge graph schema if needed

### Extending Agent Capabilities  
1. Modify LangGraph workflow nodes
2. Update context aggregation logic
3. Add new dependency relationship types
4. Enhance cross-file analysis algorithms

### Performance Optimization
- Use async processing for vector searches
- Implement streaming for large file parsing
- Cache processed results
- Parallel file parsing where possible
- Index dependency relationships for fast queries

## Important Notes

- Always activate the `codewise` conda environment before development
- Parser outputs are structured for consumption by RAG and Agent services
- The system is optimized for Chinese language code analysis and documentation
- Knowledge graph enables precise impact analysis and call chain tracking
- Bidirectional references are crucial for advanced code understanding capabilities