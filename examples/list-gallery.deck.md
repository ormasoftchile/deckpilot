---
title: "List Style Gallery"
diagrams:
  theme: default
---

## Venn (3-set)

 ```diagram:triton 
list
  style venn
  Speed
  Quality
  Cost
 ```

## Venn (2-set)

 ```diagram:triton 
list
  style venn
  Pros
  Cons
 ```

## Cycle

 ```diagram:triton 
list
  style cycle
  Plan
  Build
  Test
  Ship
 ```

## Matrix

 ```diagram:triton 
list
  style matrix
  Quick wins
  Big bets
  Fill-ins
  Money pits
 ```

## Funnel

 ```diagram:triton 
list
  style funnel
  Leads
  Qualified
  Proposals
  Closed
 ```

## Step Up

 ```diagram:triton 
list
  style stepup
  Crawl
  Walk
  Run
  Fly
 ```

## Cycle (5 nodes)

 ```diagram:triton 
list
  style cycle
  Discover
  Design
  Build
  Measure
  Learn
 ```

## Poster

 ```diagram:triton
 poster
   columns 4

   cell arr "Array"
        array 5 8 13 21 34
    end

    cell stk "Stack"
        stack
            cells main parse layout
            capacity 5
    end

    cell que "Queue"
        queue
            cells A B C
            capacity 5
    end

    cell uf "Union-Find"
        unionfind 6
            parent 0 0 1 3 3 5
    end

    cell hm "Hash map"
        hashmap
            buckets 4
            bucket 0: alice->1
            bucket 2: carol->3
            bucket 3: dave->4, erin->5
    end

    cell mat "Matrix"
        matrix
            row 1 2 3
            row 4 5 6
            row 7 8 9
    end

    cell heap "Max-heap" [1x2]
        heap max insert 50 30 70 20 40 60
    end

    cell trie "Trie" [1x2]
        trie insert cat car dog
    end

    cell graph "Graph" [2]
        nodegraph
            directed
            node A : parse
            node B : emit
            A -> B : ir
    end
 ```
