---
title: "Diagram Demo"
---


 ## Diagrams Work
 
 Here's a flow:

 1. Open Deck
 2. Parse Slides
 
 ```diagram:mermaid {theme: minimal}
 graph TD
   A[Open Deck] --> B[Parse Slides]
   B --> C[Render HTML]
   C --> D[Show Webview]
 ```

Or a sequence:

---
 
 ## Sequence
 
 ```diagram:mermaid
 sequenceDiagram
   Webview->>Conductor: navigate
   Conductor->>Renderer: resolveSlide
   Renderer-->>Webview: slideChanged
 ```

---

## Poster

```diagram:mermaid
poster "Data Structures"
  columns 4
  cell arr "Array" :: array
      array 5 8 13 21 34
  end
  cell stk "Stack" :: stack
      stack
          cells main parse layout
          capacity 5
  end
  cell que "Queue" :: queue
      queue
          cells A B C
          capacity 5
  end
  cell uf "Union-Find" :: unionfind
      unionfind 6
          parent 0 0 1 3 3 5
  end
  cell hm "Hash map" :: hashmap
      hashmap
          buckets 4
          bucket 0: alice->1
          bucket 2: carol->3
          bucket 3: dave->4, erin->5
  end
  cell mat "Matrix" :: matrix
      matrix
          row 1 2 3
          row 4 5 6
          row 7 8 9
  end
  cell heap "Max-heap" [1x2] :: heap
      heap max insert 50 30 70 20 40 60
  end
  cell trie "Trie" [1x2] :: trie
      trie insert cat car dog
  end
  cell graph "Graph" [2] :: nodegraph
      nodegraph
          directed
          node A : parse
          node B : emit
          A -> B : ir
  end
```