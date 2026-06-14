import { ToolDef } from './providers/types'

export const TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file at the given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file, creating or overwriting it.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
          content: { type: 'string', description: 'Text content to write' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Replace a specific string in a file with new content.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path' },
          oldString: { type: 'string', description: 'Exact text to find and replace' },
          newString: { type: 'string', description: 'Replacement text' }
        },
        required: ['path', 'oldString', 'newString']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories at a given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list (defaults to current)' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute a shell command on the Windows system.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to run' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch the content of a URL as text.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch' }
        },
        required: ['url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'code_search',
      description: 'Search for a pattern in the codebase using ripgrep. Supports regex. Results cap at 100 matches.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'The search pattern (regex)' },
          path: { type: 'string', description: 'Directory to search in (optional, defaults to project root)' }
        },
        required: ['pattern']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'format_file',
      description: 'Format a file using Prettier.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute or relative file path to format' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_tests',
      description: 'Run a test command in the project. Examples: "npm test", "npx vitest run", "npx jest --no-coverage". Output is capped at 10000 chars with 60s timeout.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The test command to execute' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information using DuckDuckGo. Returns a list of results with titles, snippets, and URLs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_memory',
      description: 'Read the current long-term memory (MEMORY.md). Returns key facts, preferences, and decisions remembered across conversations.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'append_memory',
      description: 'Append a new entry to long-term memory (MEMORY.md). Use to save important facts, preferences, or decisions the user wants remembered across conversations.',
      parameters: {
        type: 'object',
        properties: {
          entry: { type: 'string', description: 'The text entry to append to memory' }
        },
        required: ['entry']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_daily',
      description: 'Read today\'s daily memory file. Contains notes recorded so far today.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'append_daily',
      description: 'Append a note to today\'s daily memory file. Lighter-weight than MEMORY.md — for transient daily notes.',
      parameters: {
        type: 'object',
        properties: {
          entry: { type: 'string', description: 'The text note to append' }
        },
        required: ['entry']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_document',
      description: 'Read text content from PDF or Word (.docx) documents. Returns the extracted text along with metadata (page count, PDF version, whether encrypted).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the .pdf or .docx file' }
        },
        required: ['path']
      }
    }
  }
]
