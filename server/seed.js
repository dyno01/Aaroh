const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'aaroh.db');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
const db = require('./db');

function opt(a, b, c, d) {
  return JSON.stringify([
    { id: 'a', en: a },
    { id: 'b', en: b },
    { id: 'c', en: c },
    { id: 'd', en: d }
  ]);
}

const hash = bcrypt.hashSync('Aaroh@123', 10);
const insUser = db.prepare('INSERT INTO users (name, email, password_hash, role, avatar_color, streak) VALUES (?, ?, ?, ?, ?, ?)');
insUser.run('Meera Iyer', 'admin@aaroh.in', hash, 'admin', '#5B45EA', 12);
insUser.run('Nikita Rathod', 'demo@aaroh.in', hash, 'student', '#F0B429', 6);
insUser.run('Diya Nair', 'diya@aaroh.in', hash, 'student', '#1F9D6C', 4);
insUser.run('Kabir Bose', 'kabir@aaroh.in', hash, 'student', '#E24B4A', 3);
insUser.run('Ananya Rao', 'ananya@aaroh.in', hash, 'student', '#3B82F6', 8);

const insExam = db.prepare(`
  INSERT INTO exams (code, title, description, exam_family, stage, type, subject, duration_sec, marks_per_q,
    negative_per_q, difficulty, max_hints, hints_enabled, calculator, mark_for_review, skip_allowed, show_palette,
    bilingual, extra_time_sec, allow_pause, show_timer, allow_section_switch, instructions, is_published, coming_soon)
  VALUES (@code, @title, @description, @exam_family, @stage, @type, @subject, @duration_sec, @marks_per_q,
    @negative_per_q, @difficulty, @max_hints, 1, @calculator, 1, 1, 1, @bilingual, 0, @allow_pause, 1, @allow_section_switch, @instructions, 1, 0)
`);

const insSec = db.prepare('INSERT INTO sections (exam_id, name, duration_sec, order_index) VALUES (?, ?, ?, ?)');
const insQ = db.prepare(`
  INSERT INTO questions (exam_id, section, subject, topic, difficulty, q_en, q_hi, options_json, correct, explanation, hint, marks, negative, order_index)
  VALUES (@exam_id, @section, @subject, @topic, @difficulty, @q_en, @q_hi, @options_json, @correct, @explanation, @hint, @marks, @negative, @order_index)
`);

function addExam(meta, sections, questions) {
  const info = insExam.run({
    calculator: 0,
    bilingual: 0,
    allow_pause: 0,
    allow_section_switch: 1,
    marks_per_q: 1,
    negative_per_q: 0.25,
    max_hints: 3,
    ...meta
  });
  const id = info.lastInsertRowid;
  (sections || []).forEach((s, i) => insSec.run(id, s.name, s.duration_sec || 0, i));
  questions.forEach((q, i) => {
    insQ.run({
      exam_id: id,
      section: q.section || meta.subject || 'Paper',
      subject: q.subject || meta.subject || '',
      topic: q.topic || '',
      difficulty: q.difficulty || 'moderate',
      q_en: q.q,
      q_hi: q.q_hi || '',
      options_json: opt(q.a, q.b, q.c, q.d),
      correct: q.ans,
      explanation: q.exp || '',
      hint: q.hint || '',
      marks: q.marks ?? meta.marks_per_q ?? 1,
      negative: q.neg ?? meta.negative_per_q ?? 0.25,
      order_index: i + 1
    });
  });
  return id;
}

const dbms = [
  { q: 'Which normal form removes transitive partial dependencies on a non-prime attribute?', a: '1NF', b: '2NF', c: '3NF', d: 'BCNF', ans: 'c', topic: 'Normalization', hint: '2NF kills partial; the next one kills transitive.', exp: '3NF requires that no non-prime attribute is transitively dependent on a candidate key. 2NF only removes partial dependence on a part of a composite key.' },
  { q: 'ACID: Atomicity guarantees that a transaction is', a: 'Visible only after commit', b: 'All-or-nothing', c: 'Isolated from concurrent writers', d: 'Durable after a crash', ans: 'b', topic: 'Transactions', hint: 'Think “all statements succeed, or none do”.', exp: 'Atomicity means the transaction is treated as a single unit — it either commits fully or rolls back fully.' },
  { q: 'Which SQL command belongs to DDL?', a: 'UPDATE', b: 'GRANT', c: 'ALTER', d: 'COMMIT', ans: 'c', topic: 'SQL', hint: 'DDL changes schema, not rows.', exp: 'ALTER modifies table structure. UPDATE is DML, GRANT is DCL, COMMIT is TCL.' },
  { q: 'In a B+ tree used as a database index, data pointers live in', a: 'Only the root', b: 'Internal nodes only', c: 'Leaf nodes only', d: 'Every node', ans: 'c', topic: 'Indexing', hint: 'Internal nodes are routing; leaves hold the keys + pointers.', exp: 'B+ trees store all actual record pointers in the linked leaf level so range scans are sequential.' },
  { q: 'Two-phase locking (2PL) guarantees', a: 'Deadlock freedom', b: 'Conflict serializability', c: 'Recoverability from dirty reads', d: 'Starvation freedom', ans: 'b', topic: 'Concurrency', hint: 'Growing then shrinking lock phases → serializable schedules.', exp: 'Strict 2PL also gives recoverability, but basic 2PL only guarantees conflict serializability. Deadlocks are still possible.' },
  { q: 'A foreign key constraint enforces', a: 'Entity integrity', b: 'Referential integrity', c: 'Domain integrity', d: 'User-defined integrity only', ans: 'b', topic: 'Keys', hint: 'Child rows must point at a living parent.', exp: 'Entity integrity is about primary keys being unique/not null. Foreign keys enforce referential integrity.' },
  { q: 'Which isolation level allows non-repeatable reads but forbids dirty reads?', a: 'Read Uncommitted', b: 'Read Committed', c: 'Repeatable Read', d: 'Serializable', ans: 'b', topic: 'Isolation', hint: 'The default in PostgreSQL and SQL Server.', exp: 'Read Committed sees only committed data, so no dirty reads, but a second read of the same row may change.' },
  { q: 'The result of INNER JOIN of R and S contains tuples that', a: 'Are in R or S', b: 'Match the join condition in both', c: 'Are in R but not S', d: 'Have NULLs padded from S', ans: 'b', topic: 'Joins', hint: 'Inner = intersection of matching keys.', exp: 'INNER JOIN returns only combinations that satisfy the ON condition. NULLs for non-matches appear in OUTER joins.' },
  { q: 'Which file organisation is best for a query that retrieves records in primary-key order over a large range?', a: 'Heap', b: 'Hash', c: 'B+ tree clustered', d: 'Unclustered hash', ans: 'c', topic: 'Storage', hint: 'Range + order → tree, not hash.', exp: 'Hash indexes shine at equality. Clustered B+ trees keep rows in key order, so range scans are sequential I/O.' },
  { q: 'Lost update anomaly occurs when', a: 'A transaction reads uncommitted data', b: 'Two transactions overwrite each other’s write', c: 'A row disappears after being read', d: 'A phantom row appears in a range', ans: 'b', topic: 'Anomalies', hint: 'T1 writes, T2 writes the same item, T1’s write vanishes.', exp: 'Lost update: both read the same value and write back, so one write silently disappears.' },
  { q: 'Which of the following is a DCL statement?', a: 'TRUNCATE', b: 'REVOKE', c: 'MERGE', d: 'SAVEPOINT', ans: 'b', topic: 'SQL', hint: 'DCL is about privileges.', exp: 'GRANT and REVOKE are DCL. TRUNCATE is DDL (or DML in some engines), MERGE is DML, SAVEPOINT is TCL.' },
  { q: 'BCNF is a stricter form of 3NF that additionally requires', a: 'No multi-valued dependencies', b: 'Every determinant is a candidate key', c: 'No partial dependencies', d: 'All attributes atomic', ans: 'b', topic: 'Normalization', hint: '3NF allows a non-key determinant if the dependent is prime.', exp: 'For every non-trivial FD X → Y, X must be a superkey. That is the BCNF rule.' }
];

const nets = [
  { q: 'In the OSI model, routing is a function of the', a: 'Data link layer', b: 'Network layer', c: 'Transport layer', d: 'Session layer', ans: 'b', topic: 'OSI', hint: 'IP lives here.', exp: 'The network layer (Layer 3) handles logical addressing and routing (IP, ICMP, routers).' },
  { q: 'TCP is distinguished from UDP primarily by', a: 'Being connection-oriented and reliable', b: 'Using port numbers', c: 'Running over IP', d: 'Supporting broadcast', ans: 'a', topic: 'TCP/IP', hint: 'Three-way handshake + ACKs.', exp: 'Both use ports and IP. TCP adds connections, sequencing, retransmission and flow control.' },
  { q: 'A subnet mask of 255.255.255.192 on a /24 network yields how many usable hosts per subnet?', a: '62', b: '64', c: '30', d: '126', ans: 'a', topic: 'Subnetting', hint: '192 = 2 bits of subnet, 6 bits of host. Subtract 2.', exp: '255.255.255.192 is /26. 2^6 = 64 addresses, minus network and broadcast = 62 usable.' },
  { q: 'Which protocol maps IPv4 addresses to MAC addresses on a LAN?', a: 'DNS', b: 'RARP', c: 'ARP', d: 'DHCP', ans: 'c', topic: 'Protocols', hint: '“Who has 192.168.1.1? Tell me.”', exp: 'ARP resolves IP → MAC. RARP is the reverse (obsolete), DNS is names, DHCP assigns IPs.' },
  { q: 'CSMA/CD is associated with', a: 'Token Ring', b: 'Classic Ethernet', c: 'Wi-Fi 802.11', d: 'Frame Relay', ans: 'b', topic: 'MAC', hint: 'Collision detection, not collision avoidance.', exp: 'Wired Ethernet used CSMA/CD. Wi-Fi uses CSMA/CA because stations cannot reliably detect collisions over radio.' },
  { q: 'HTTPS typically encrypts the HTTP payload using TLS at which conceptual layer?', a: 'Network', b: 'Transport-adjacent / session', c: 'Physical', d: 'Data link', ans: 'b', topic: 'Security', hint: 'TLS sits on top of TCP, below HTTP.', exp: 'TLS is often described as between transport and application. It is not a Layer-3 or Layer-2 protocol.' },
  { q: 'Distance-vector routing is used by', a: 'OSPF', b: 'IS-IS', c: 'RIP', d: 'BGP path-vector only as link-state', ans: 'c', topic: 'Routing', hint: 'Hop count, 15-hop limit, rumour mill.', exp: 'RIP is the classic distance-vector protocol. OSPF and IS-IS are link-state. BGP is path-vector.' },
  { q: 'IPv6 addresses are how many bits long?', a: '32', b: '64', c: '128', d: '256', ans: 'c', topic: 'IPv6', hint: 'Four times IPv4.', exp: 'IPv6 uses 128-bit addresses, commonly written as eight hex groups.' },
  { q: 'Which device operates primarily at Layer 2 and forwards using MAC tables?', a: 'Hub', b: 'Router', c: 'Switch', d: 'Repeater', ans: 'c', topic: 'Devices', hint: 'Learns source MACs, floods unknowns.', exp: 'Switches are Layer-2 bridges with CAM tables. Hubs are Layer 1. Routers are Layer 3.' },
  { q: 'The well-known port for DNS is', a: '25', b: '53', c: '80', d: '110', ans: 'b', topic: 'Ports', hint: 'SMTP 25, HTTP 80, POP3 110.', exp: 'DNS uses UDP/TCP port 53.' },
  { q: 'Sliding window protocols belong mainly to the', a: 'Physical layer', b: 'Data link / transport reliability', c: 'Application layer', d: 'Presentation layer', ans: 'b', topic: 'Flow control', hint: 'Go-Back-N and Selective Repeat.', exp: 'Sliding windows provide flow and error control at data-link (HDLC) and transport (TCP) layers.' },
  { q: 'NAT primarily solves', a: 'Slow DNS resolution', b: 'IPv4 address exhaustion at the edge', c: 'TCP head-of-line blocking', d: 'Wireless hidden-node problem', ans: 'b', topic: 'NAT', hint: 'Many private hosts, one public IP.', exp: 'Network Address Translation lets a private RFC1918 network share scarce public IPv4 addresses.' }
];

const os = [
  { q: 'A process in the blocked/waiting state is waiting for', a: 'The dispatcher', b: 'An event such as I/O', c: 'Its time quantum only', d: 'Compilation to finish', ans: 'b', topic: 'Processes', hint: 'Not short on CPU — short on an event.', exp: 'Blocked/waiting means the process cannot run until an event (I/O completion, semaphore, etc.) occurs.' },
  { q: 'Which scheduling algorithm can lead to starvation of long jobs?', a: 'FCFS', b: 'Round Robin', c: 'SJF', d: 'Aging-enabled priority', ans: 'c', topic: 'Scheduling', hint: 'Short jobs keep cutting in line.', exp: 'Shortest Job First (and SRTF) can starve long processes if short ones keep arriving. Aging is a fix for priority starvation.' },
  { q: 'A deadlock is possible only if which set of conditions holds?', a: 'Mutual exclusion, hold-and-wait, no preemption, circular wait', b: 'Paging, segmentation, swapping, thrashing', c: 'Race, livelock, starvation, aging', d: 'Kernel mode, user mode, interrupt, trap', ans: 'a', topic: 'Deadlock', hint: 'Coffman conditions — all four.', exp: 'Coffman’s four conditions are necessary for deadlock. Breaking any one prevents it.' },
  { q: 'Thrashing in virtual memory is caused by', a: 'Too large a page size', b: 'Excessive page faults from insufficient frames', c: 'A RAID rebuild', d: 'A CPU cache miss', ans: 'b', topic: 'Memory', hint: 'The system spends all its time paging.', exp: 'When the working set cannot fit in RAM, page-fault rate explodes and CPU utilisation collapses — thrashing.' },
  { q: 'Belady’s anomaly is observed in', a: 'LRU', b: 'Optimal', c: 'FIFO', d: 'LFU with proper counters', ans: 'c', topic: 'Paging', hint: 'More frames, more faults — only some algorithms.', exp: 'FIFO (and random) can fault more after adding frames. Stack algorithms like LRU and Optimal do not.' },
  { q: 'A semaphore’s wait (P) operation is', a: 'Always non-blocking', b: 'Atomic decrement, block if negative', c: 'Used only in user space', d: 'Equivalent to a spinlock always', ans: 'b', topic: 'Sync', hint: 'P = probeer, V = verhogen.', exp: 'Classic Dijkstra semaphore: P atomically decrements and sleeps if the value goes negative; V increments and wakes.' },
  { q: 'Which disk scheduling algorithm is least sensitive to starvation of requests at the edges?', a: 'FCFS', b: 'SSTF', c: 'SCAN (elevator)', d: 'LIFO', ans: 'c', topic: 'Disk', hint: 'The head sweeps end to end.', exp: 'SSTF starves far requests. SCAN/C-SCAN visit the extremities regularly, so edges are served.' },
  { q: 'In paging, the page table maps', a: 'Physical frames to files', b: 'Virtual pages to physical frames', c: 'Sectors to cylinders', d: 'Sockets to ports', ans: 'b', topic: 'Paging', hint: 'VPN → PFN.', exp: 'Each process has a page table translating virtual page numbers to frame numbers (plus bits: valid, dirty, etc.).' },
  { q: 'A thread shares with its siblings', a: 'Stack and registers', b: 'Address space, heap and open files', c: 'Program counter only', d: 'Nothing — threads are processes', ans: 'b', topic: 'Threads', hint: 'Private: stack, SP, PC. Shared: the process.', exp: 'Threads of a process share code, data, heap and files. Each thread has its own stack and registers.' },
  { q: 'Copy-on-write after fork() means', a: 'The child gets a full eager copy of RAM', b: 'Pages are shared read-only until a write', c: 'Only the PCB is copied, never pages', d: 'The parent is frozen until exec', ans: 'b', topic: 'Fork', hint: 'Share now, duplicate on the first store.', exp: 'Modern Unix marks pages COW; a private copy is made only when either side writes.' },
  { q: 'Which is a non-preemptive algorithm?', a: 'SRTF', b: 'Round Robin', c: 'FCFS', d: 'Preemptive priority', ans: 'c', topic: 'Scheduling', hint: 'Once it starts, it runs to completion (or block).', exp: 'FCFS and non-preemptive SJF/priority do not yank the CPU mid-burst. RR and SRTF do.' },
  { q: 'The Banker’s algorithm is used for deadlock', a: 'Detection', b: 'Prevention via mutual exclusion', c: 'Avoidance', d: 'Recovery by kill-all', ans: 'c', topic: 'Deadlock', hint: 'Stay in a safe state.', exp: 'Banker simulates allocations and only grants a request if a safe sequence still exists — avoidance, not detection.' }
];

const dsa = [
  { q: 'Worst-case time of QuickSort is', a: 'O(n log n)', b: 'O(n)', c: 'O(n²)', d: 'O(log n)', ans: 'c', topic: 'Sorting', hint: 'Already sorted + bad pivot.', exp: 'Unbalanced partitions (sorted input, first/last pivot) yield T(n)=T(n-1)+Θ(n) = Θ(n²). Average is n log n.' },
  { q: 'A complete binary tree with 31 nodes has how many levels? (root = level 1)', a: '4', b: '5', c: '6', d: '31', ans: 'b', topic: 'Trees', hint: '2^k − 1 = 31.', exp: 'A perfect tree of height 5 (levels 1..5) has 2^5 − 1 = 31 nodes.' },
  { q: 'BFS on an unweighted graph yields', a: 'Longest path', b: 'Minimum spanning tree always', c: 'Shortest path in number of edges', d: 'Topological order', ans: 'c', topic: 'Graphs', hint: 'Layer by layer from the source.', exp: 'BFS explores in distance-from-source order, so the first time you reach a node is a shortest hop-path.' },
  { q: 'Which data structure is used for undo in a text editor?', a: 'Queue', b: 'Stack', c: 'Hash table', d: 'Priority queue', ans: 'b', topic: 'Stacks', hint: 'Last action reversed first.', exp: 'Undo is LIFO — a stack of inverse operations.' },
  { q: 'In a max-heap, the largest element is always at', a: 'A random leaf', b: 'The root', c: 'The last level, leftmost', d: 'An internal node of degree 1', ans: 'b', topic: 'Heaps', hint: 'Heap-order property.', exp: 'Max-heap: parent ≥ children, so the maximum sits at the root.' },
  { q: 'Hash table with chaining: expected search time with load factor α is', a: 'O(α)', b: 'O(n)', c: 'O(log n)', d: 'O(1) worst case', ans: 'a', topic: 'Hashing', hint: 'Average chain length is α = n/m.', exp: 'Simple uniform hashing: unsuccessful search is Θ(1+α). Worst case is still Θ(n).' },
  { q: 'Dijkstra’s algorithm fails when the graph has', a: 'Cycles', b: 'Negative-weight edges', c: 'Undirected edges', d: 'More than one source', ans: 'b', topic: 'Graphs', hint: 'Greedy “settled” nodes can be wrong if a negative edge later improves them.', exp: 'Dijkstra assumes non-negative weights. Use Bellman-Ford when negatives exist (but no negative cycle).' },
  { q: 'The infix expression a+b*c is equivalent to postfix', a: 'ab+c*', b: 'abc*+', c: 'ab*c+', d: '+a*bc', ans: 'b', topic: 'Expressions', hint: 'Multiply first, then add.', exp: 'b*c happens first: bc*, then add a: abc*+.' },
  { q: 'Time complexity of binary search on a sorted array of n elements is', a: 'O(n)', b: 'O(log n)', c: 'O(n log n)', d: 'O(1)', ans: 'b', topic: 'Searching', hint: 'Halve the interval each step.', exp: 'Each comparison discards half the remaining range → Θ(log n).' },
  { q: 'A queue can be efficiently implemented using', a: 'One stack only, amortised O(1) impossible', b: 'Two stacks', c: 'A single register', d: 'A max-heap only', ans: 'b', topic: 'Queues', hint: 'Inbox and outbox stacks.', exp: 'Two stacks: enqueue to in-stack, dequeue from out-stack (pour when empty). Amortised O(1).' }
];

const se = [
  { q: 'In the Waterfall model, the next phase starts', a: 'In parallel with coding', b: 'Only after the previous phase is signed off', c: 'After daily stand-ups', d: 'Whenever a spike is needed', ans: 'b', topic: 'SDLC', hint: 'Linear, gated.', exp: 'Classic waterfall is sequential; a phase begins after the previous deliverable is approved.' },
  { q: 'Cyclomatic complexity of a program with 8 edges and 6 nodes (1 connected component) is', a: '2', b: '3', c: '4', d: '14', ans: 'c', topic: 'Metrics', hint: 'E − N + 2P.', exp: 'V(G) = E − N + 2P = 8 − 6 + 2 = 4.' },
  { q: 'Black-box testing is based on', a: 'Source code paths', b: 'Specifications / requirements', c: 'Compiler listings', d: 'Mutation operators', ans: 'b', topic: 'Testing', hint: 'You never open the box.', exp: 'Black-box (functional) testing derives cases from the spec, not the internals. White-box uses code structure.' },
  { q: 'Coupling is a measure of', a: 'How related a module’s internals are', b: 'Interdependence between modules', c: 'Lines of code', d: 'Test coverage', ans: 'b', topic: 'Design', hint: 'Low coupling, high cohesion.', exp: 'Coupling = interdependence across modules. Cohesion = relatedness inside a module.' },
  { q: 'Which Agile artefact lists work remaining for the product?', a: 'Sprint burndown only', b: 'Product backlog', c: 'Definition of Done', d: 'Velocity chart', ans: 'b', topic: 'Agile', hint: 'Owned by the Product Owner.', exp: 'The product backlog is the ordered list of everything that might be needed in the product.' },
  { q: 'Regression testing is performed to', a: 'Test a brand-new module in isolation only', b: 'Ensure old features still work after changes', c: 'Measure cyclomatic complexity', d: 'Replace unit tests', ans: 'b', topic: 'Testing', hint: 'Did the fix break something else?', exp: 'Regression tests re-run previous cases after a change to catch unintended breakage.' },
  { q: 'SRS is produced in which phase?', a: 'Coding', b: 'Requirements / analysis', c: 'Maintenance', d: 'Deployment', ans: 'b', topic: 'SRS', hint: 'Software Requirements Specification.', exp: 'The SRS captures functional and non-functional requirements before design.' },
  { q: 'The V-model pairs each development stage with', a: 'A marketing campaign', b: 'A corresponding test level', c: 'A git branch', d: 'A cloud region', ans: 'b', topic: 'SDLC', hint: 'Verification on the left, validation on the right.', exp: 'Requirements↔acceptance, design↔integration/system, code↔unit tests.' }
];

const oop = [
  { q: 'Polymorphism in OOP primarily allows', a: 'Data hiding via private fields', b: 'The same interface to behave differently by type', c: 'Multiple inheritance only', d: 'Faster compilation', ans: 'b', topic: 'OOP', hint: 'One name, many forms.', exp: 'Compile-time (overloading) and runtime (overriding) polymorphism let one interface dispatch to different implementations.' },
  { q: 'Encapsulation is achieved mainly by', a: 'Making all fields public', b: 'Bundling data with methods and restricting access', c: 'Using multiple inheritance', d: 'Avoiding classes', ans: 'b', topic: 'OOP', hint: 'Private state, public API.', exp: 'Encapsulation hides representation behind a well-defined interface.' },
  { q: 'A pure virtual function in C++ makes the class', a: 'Final', b: 'Abstract', c: 'A singleton', d: 'A friend', ans: 'b', topic: 'C++', hint: 'virtual void f() = 0;', exp: 'A class with at least one pure virtual function is abstract and cannot be instantiated.' },
  { q: 'Which relationship is “has-a”?', a: 'Inheritance', b: 'Composition / aggregation', c: 'Polymorphism', d: 'Interface implementation', ans: 'b', topic: 'Design', hint: 'Car has-an Engine.', exp: 'Inheritance is is-a. Composition/aggregation is has-a.' },
  { q: 'Java interfaces (classic) can contain', a: 'Instance fields that are mutable', b: 'Abstract method declarations (and later default methods)', c: 'Constructors', d: 'Multiple parent classes', ans: 'b', topic: 'Java', hint: 'Contracts, not state.', exp: 'Classic Java interfaces declare methods (plus constants). Java 8 added default/static methods. No constructors, no mutable instance fields.' },
  { q: 'Overloading is resolved at', a: 'Runtime by the JVM vtable only', b: 'Compile time by signature', c: 'Link time by the loader', d: 'Never — it is overriding', ans: 'b', topic: 'Overload', hint: 'Same name, different parameter lists.', exp: 'Overload resolution uses the static types of arguments at compile time. Overriding is dynamic dispatch.' }
];

const cyber = [
  { q: 'A digital signature provides', a: 'Confidentiality only', b: 'Authentication and integrity (non-repudiation)', c: 'Availability via RAID', d: 'Steganography', ans: 'b', topic: 'Crypto', hint: 'Private key signs, public key verifies.', exp: 'Signatures (e.g. RSA/ECDSA) bind a document to a private key, giving integrity, authentication and non-repudiation — not secrecy.' },
  { q: 'A firewall’s typical job is to', a: 'Encrypt disks', b: 'Filter traffic by policy (ports, IPs, state)', c: 'Replace antivirus', d: 'Assign IP addresses', ans: 'b', topic: 'Network security', hint: 'Permit/deny at the perimeter or host.', exp: 'Firewalls enforce a network policy: which packets may pass. They are not a substitute for endpoint AV or DHCP.' },
  { q: 'SQL injection is best classified as', a: 'A cryptographic failure', b: 'An input-validation / query-construction flaw', c: 'A physical attack', d: 'A CSRF-only issue', ans: 'b', topic: 'AppSec', hint: 'Untrusted string becomes SQL syntax.', exp: 'Concatenating user input into SQL lets an attacker change the query. Parameterised queries are the fix.' },
  { q: 'AES is a', a: 'Asymmetric algorithm', b: 'Symmetric block cipher', c: 'Hash function', d: 'Stream cipher only in ECB', ans: 'b', topic: 'Crypto', hint: 'Same key to encrypt and decrypt; 128-bit blocks.', exp: 'AES is the NIST symmetric block cipher (128-bit block, 128/192/256-bit keys). RSA is asymmetric; SHA is a hash.' },
  { q: 'Phishing is primarily', a: 'A buffer overflow', b: 'Social engineering to steal credentials', c: 'A RAID failure', d: 'A SYN flood', ans: 'b', topic: 'Threats', hint: 'Fake login pages, urgent emails.', exp: 'Phishing tricks humans into revealing secrets or installing malware. It is social engineering, not a CPU exploit.' },
  { q: 'CIA triad stands for', a: 'Confidentiality, Integrity, Availability', b: 'Control, Identity, Access', c: 'Cipher, IV, Authentication', d: 'Central, Internal, Audit', ans: 'a', topic: 'Fundamentals', hint: 'The three classic security goals.', exp: 'Information security is often framed as keeping data secret, unaltered, and reachable when needed.' }
];

const coa = [
  { q: 'A full adder adds', a: 'Two bits and a carry-in', b: 'Two 8-bit bytes', c: 'Only two bits with no carry', d: 'A nibble and a flag', ans: 'a', topic: 'Digital', hint: 'Three inputs: A, B, Cin.', exp: 'A full adder has inputs A, B, Cin and outputs Sum, Cout. A half adder has no Cin.' },
  { q: 'Pipelining improves', a: 'Latency of a single instruction always', b: 'Throughput of the instruction stream', c: 'Disk seek time', d: 'Cache associativity', ans: 'b', topic: 'Pipeline', hint: 'Overlap stages; one result per cycle in steady state.', exp: 'Pipeline overlapping raises instruction throughput. A single instruction may even have slightly higher latency due to latches.' },
  { q: 'Write-through cache policy updates', a: 'Only the cache, memory later', b: 'Cache and memory on every write', c: 'Memory only on eviction', d: 'Registers only', ans: 'b', topic: 'Cache', hint: 'Through = go through to RAM.', exp: 'Write-through writes both levels immediately. Write-back writes memory only when a dirty line is evicted.' },
  { q: 'The program counter holds', a: 'The last ALU result', b: 'The address of the next instruction', c: 'The stack pointer', d: 'The interrupt mask', ans: 'b', topic: 'CPU', hint: 'PC / IP.', exp: 'PC stores the address of the next instruction to fetch.' },
  { q: 'RAID 1 provides', a: 'Striping without parity', b: 'Mirroring', c: 'Double parity', d: 'Hot spares only', ans: 'b', topic: 'RAID', hint: 'Two disks, same data.', exp: 'RAID 1 mirrors. RAID 0 stripes with no redundancy. RAID 5/6 use parity.' },
  { q: 'Little-endian machines store the least significant byte of a word at', a: 'The highest address', b: 'The lowest address', c: 'The cache tag', d: 'The stack only', ans: 'b', topic: 'Endian', hint: 'Intel x86 is little-endian.', exp: 'Little-endian: LSB at the smallest address. Big-endian stores MSB first.' }
];

const web = [
  { q: 'HTTP 304 means', a: 'Created', b: 'Not Modified', c: 'Forbidden', d: 'Gateway Timeout', ans: 'b', topic: 'HTTP', hint: 'Conditional GET, cache still valid.', exp: '304 Not Modified tells the client to reuse its cached copy. 201 Created, 403 Forbidden, 504 Gateway Timeout.' },
  { q: 'REST’s uniform interface includes', a: 'Sticky sessions required', b: 'Resource identification via URIs and standard verbs', c: 'SOAP envelopes', d: 'Only POST for all actions', ans: 'b', topic: 'REST', hint: 'GET/POST/PUT/DELETE on nouns.', exp: 'REST identifies resources with URIs and manipulates them with a uniform set of methods and representations.' },
  { q: 'Cookies marked HttpOnly are not accessible from', a: 'The server', b: 'JavaScript in the page', c: 'The next HTTP request', d: 'HTTPS', ans: 'b', topic: 'Cookies', hint: 'Mitigates XSS cookie theft.', exp: 'HttpOnly cookies are sent to the server but hidden from document.cookie.' },
  { q: 'JSON is a', a: 'Binary protocol', b: 'Text data format derived from JavaScript literals', c: 'Database engine', d: 'TLS cipher', ans: 'b', topic: 'JSON', hint: 'Curly braces, no functions.', exp: 'JSON is a language-independent text format for objects, arrays, strings, numbers, booleans and null.' }
];

const eng = [
  { q: 'Choose the correctly spelled word.', a: 'Accomodate', b: 'Acommodate', c: 'Accommodate', d: 'Acomodate', ans: 'c', topic: 'Spelling', hint: 'Double c, double m.', exp: 'Accommodate has two c’s and two m’s.' },
  { q: 'Identify the error: “Neither of the boys have submitted their form.”', a: 'Neither', b: 'have', c: 'their', d: 'No error', ans: 'b', topic: 'Grammar', hint: 'Neither is singular.', exp: 'Neither takes a singular verb: “Neither of the boys has submitted…”' },
  { q: 'Synonym of “Candid”', a: 'Secretive', b: 'Frank', c: 'Biased', d: 'Vague', ans: 'b', topic: 'Vocab', hint: 'A candid interview.', exp: 'Candid means frank, open, straightforward.' },
  { q: 'Antonym of “Scarce”', a: 'Rare', b: 'Meagre', c: 'Abundant', d: 'Sparse', ans: 'c', topic: 'Vocab', hint: 'Opposite of not enough.', exp: 'Scarce ↔ abundant / plentiful.' },
  { q: 'Fill in: She insisted ___ paying the bill.', a: 'on', b: 'at', c: 'for', d: 'to', ans: 'a', topic: 'Preposition', hint: 'Insist on + gerund.', exp: 'The collocation is insist on (doing) something.' },
  { q: 'The phrase “beat around the bush” means', a: 'Hit shrubbery', b: 'Avoid the main point', c: 'Work in a garden', d: 'Celebrate wildly', ans: 'b', topic: 'Idiom', hint: 'Not coming to the point.', exp: 'To beat around the bush is to delay talking about the important issue.' },
  { q: 'Choose the correctly punctuated sentence.', a: 'Its a fine day, isnt it?', b: "It's a fine day, isn't it?", c: 'Its a fine day isnt it.', d: "Its' a fine day, isn't it?", ans: 'b', topic: 'Punctuation', hint: 'It’s = it is; isn’t needs an apostrophe.', exp: 'Contractions take apostrophes: It’s, isn’t.' },
  { q: 'One-word for “a person who loves books”', a: 'Bibliophile', b: 'Philatelist', c: 'Cartographer', d: 'Omnivore', ans: 'a', topic: 'Vocab', hint: 'Biblio = book.', exp: 'Bibliophile loves books. Philatelist collects stamps.' }
];

const reas = [
  { q: 'If ALL PENCILS are PENS and SOME PENS are ERASERS, which is definitely true?', a: 'All erasers are pencils', b: 'Some pencils are erasers', c: 'Some pens are pencils', d: 'No pen is a pencil', ans: 'c', topic: 'Syllogism', hint: 'All pencils sit inside pens.', exp: 'All pencils are pens ⇒ some pens are pencils (conversion of A, valid as I). The eraser overlap is with pens, not necessarily pencils.' },
  { q: 'Find the odd one: 3, 8, 15, 24, 35, 48, 63', a: '8', b: '48', c: '63', d: '24', ans: 'b', topic: 'Number series', hint: 'n² − 1 pattern.', exp: '2²−1=3, 3²−1=8, 4²−1=15, 5²−1=24, 6²−1=35, 7²−1=48 should be 49−1=48 wait — 8²−1=63. Sequence is (n(n+1)) : 1·2+1? Better: 2×2−1=3, 3×3−1=8, 4×4−1=15, 5×5−1=24, 6×6−1=35, 7×7−1=48, 8×8−1=63. All fit. Alternate: +5,+7,+9,+11,+13,+15. 35+13=48, 48+15=63. All fit… Odd via  n²−1 all perfect. 48 = 7²−1 yes. Perhaps 48 should be 49 if +5,+7,+9,+11,+13,+15 from 3: 3,8,15,24,35,48,63 is consistent. Let me use a cleaner odd-one.' , ansKeep: true },
  { q: 'Pointing to a photograph, Rina says, “He is the only son of my mother’s only daughter.” Who is he?', a: 'Her brother', b: 'Her father', c: 'Her son', d: 'Her uncle', ans: 'c', topic: 'Blood relation', hint: 'Mother’s only daughter is Rina herself (if she has no sister).', exp: 'My mother’s only daughter = Rina (assuming she is that daughter). Her only son is the boy in the photo.' },
  { q: 'If in a certain code MANGO is written as NBOHP, then APPLE is', a: 'BQQMF', b: 'BQQMD', c: 'Zookd', d: 'AQQLF', ans: 'a', topic: 'Coding', hint: 'Each letter +1.', exp: 'M→N, A→B, N→O, G→H, O→P. So A→B, P→Q, P→Q, L→M, E→F → BQQMF.' },
  { q: 'A is taller than B but shorter than C. D is shorter than B. Who is the tallest?', a: 'A', b: 'B', c: 'C', d: 'D', ans: 'c', topic: 'Ordering', hint: 'C > A > B > D.', exp: 'C is taller than A, who is taller than B, who is taller than D. C is tallest.' },
  { q: 'Statements: All flowers are trees. Some trees are herbs. Conclusions: I Some flowers are herbs. II Some trees are flowers.', a: 'Only I', b: 'Only II', c: 'Both', d: 'Neither', ans: 'b', topic: 'Syllogism', hint: 'All flowers ⊂ trees ⇒ some trees are flowers. Herbs may miss flowers.', exp: 'Conversion of “All flowers are trees” gives “Some trees are flowers”. I does not follow.' },
  { q: 'If 15th August 2026 is a Saturday, 1st August 2026 is a', a: 'Saturday', b: 'Friday', c: 'Sunday', d: 'Thursday', ans: 'a', topic: 'Calendar', hint: '15 − 1 = 14 days = 2 weeks.', exp: '14 days earlier is the same weekday: Saturday.' },
  { q: 'Complete the series: AZ, BY, CX, ?', a: 'DW', b: 'EV', c: 'DU', d: 'DW is wrong wait', ans: 'a', topic: 'Letter series', hint: 'First letters A,B,C,… last letters Z,Y,X,…', exp: 'Next is D and W → DW.' }
];

// Fix the broken reasoning question - replace the messy series one
reas[1] = { q: 'Find the odd one out: 8, 27, 64, 100, 125, 216', a: '27', b: '100', c: '125', d: '216', ans: 'b', topic: 'Number series', hint: 'Cubes versus a square.', exp: '8=2³, 27=3³, 64=4³, 125=5³, 216=6³. 100 = 10² is not a cube.' };

const quant = [
  { q: 'A sum of ₹12,000 becomes ₹13,200 in 2 years at simple interest. The rate is', a: '4%', b: '5%', c: '6%', d: '8%', ans: 'b', topic: 'SI', hint: 'Interest = 1,200 in 2 years.', exp: 'SI = 1200. R = (1200 × 100) / (12000 × 2) = 5%.' },
  { q: 'The average of 5 numbers is 20. If one number 15 is replaced by 30, the new average is', a: '21', b: '23', c: '25', d: '18', ans: 'b', topic: 'Average', hint: 'Total increases by 15.', exp: 'Old total 100. New total 115. Average 115/5 = 23.' },
  { q: 'A train 180 m long runs at 54 km/h. Time to pass a pole is', a: '10 s', b: '12 s', c: '15 s', d: '18 s', ans: 'b', topic: 'Time-speed', hint: '54 km/h = 15 m/s.', exp: '54 × 5/18 = 15 m/s. t = 180/15 = 12 s.' },
  { q: 'If 40% of a number is 240, the number is', a: '96', b: '600', c: '480', d: '720', ans: 'b', topic: 'Percentage', hint: '0.4x = 240.', exp: 'x = 240 / 0.4 = 600.' },
  { q: 'The ratio 2:3 equals which percent?', a: '40%', b: '60%', c: '66.67%', d: '23%', ans: 'c', topic: 'Ratio', hint: '2/3.', exp: '2/3 × 100 = 66.67%.' },
  { q: 'A and B together finish a work in 12 days. A alone takes 20 days. B alone takes', a: '24 days', b: '30 days', c: '15 days', d: '8 days', ans: 'b', topic: 'Work', hint: '1/12 − 1/20.', exp: 'B = 1/12 − 1/20 = (5−3)/60 = 1/30 → 30 days.' },
  { q: 'CI on ₹5,000 at 10% per annum for 2 years, compounded annually, is', a: '₹1,000', b: '₹1,050', c: '₹1,100', d: '₹500', ans: 'b', topic: 'CI', hint: 'Amount = 5000 × 1.1².', exp: 'Amount = 5000 × 1.21 = 6050. CI = 1050.' },
  { q: 'The next number in 2, 6, 12, 20, 30, ? is', a: '36', b: '40', c: '42', d: '44', ans: 'c', topic: 'Series', hint: '+4, +6, +8, +10, +12.', exp: 'n(n+1): 1×2, 2×3, 3×4, 4×5, 5×6, 6×7=42.' }
];

const prelimsInstructions = `IBPS SO IT Officer — Prelims pattern (short mock)
• Objective paper with sectional navigation.
• +marks for a correct answer, −0.25 of the question’s marks for a wrong one. Unattempted = 0.
• Use Mark for Review, the palette, and hints (capped by your coach).
• Do not reload. Answers autosave every few seconds.
• Hints never reveal the key — they nudge the concept.`;

const mainsInstructions = `IBPS SO IT Officer — Mains Professional Knowledge
• This paper decides merit (with interview). English/Reasoning/Quant in the real mains are qualifying.
• Negative marking 0.25 of the question’s marks.
• High-influence topics: DBMS, Computer Networks, Operating Systems.
• Coach can change hint caps and permissions live — watch the toast.`;

addExam({
  code: 'SOIT-PRE-01',
  title: 'Prelims Full Mock 01 — New Pattern',
  description: 'English, Reasoning, Quant and a bite of Professional Knowledge. Short full mock so you can finish a hall-like paper tonight.',
  exam_family: 'IBPS_SO_IT',
  stage: 'prelims',
  type: 'full',
  subject: null,
  duration_sec: 25 * 60,
  marks_per_q: 1,
  negative_per_q: 0.25,
  difficulty: 'moderate',
  max_hints: 4,
  allow_section_switch: 1,
  instructions: prelimsInstructions
}, [
  { name: 'English Language', duration_sec: 6 * 60 },
  { name: 'Reasoning', duration_sec: 7 * 60 },
  { name: 'Quantitative Aptitude', duration_sec: 6 * 60 },
  { name: 'Professional Knowledge', duration_sec: 6 * 60 }
], [
  ...eng.slice(0, 6).map((q) => ({ ...q, section: 'English Language', subject: 'English', marks: 1 })),
  ...reas.slice(0, 6).map((q) => ({ ...q, section: 'Reasoning', subject: 'Reasoning', marks: 1 })),
  ...quant.slice(0, 6).map((q) => ({ ...q, section: 'Quantitative Aptitude', subject: 'Quant', marks: 1 })),
  ...dbms.slice(0, 3).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'DBMS', marks: 2 })),
  ...nets.slice(0, 2).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'Networks', marks: 2 })),
  ...os.slice(0, 1).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'OS', marks: 2 }))
]);

addExam({
  code: 'SOIT-PRE-02',
  title: 'Prelims Full Mock 02 — Speed Set',
  description: 'Tighter English + Quant with a slightly harder PK mix. Built for a second attempt this week.',
  exam_family: 'IBPS_SO_IT',
  stage: 'prelims',
  type: 'full',
  subject: null,
  duration_sec: 20 * 60,
  marks_per_q: 1,
  negative_per_q: 0.25,
  difficulty: 'moderate-hard',
  max_hints: 3,
  instructions: prelimsInstructions
}, [
  { name: 'English Language', duration_sec: 5 * 60 },
  { name: 'Reasoning', duration_sec: 5 * 60 },
  { name: 'Quantitative Aptitude', duration_sec: 5 * 60 },
  { name: 'Professional Knowledge', duration_sec: 5 * 60 }
], [
  ...eng.slice(2, 8).map((q) => ({ ...q, section: 'English Language', subject: 'English' })),
  ...reas.slice(2, 8).map((q) => ({ ...q, section: 'Reasoning', subject: 'Reasoning' })),
  ...quant.slice(2, 8).map((q) => ({ ...q, section: 'Quantitative Aptitude', subject: 'Quant' })),
  ...os.slice(0, 3).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'OS', marks: 2 })),
  ...dsa.slice(0, 3).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'DSA', marks: 2 }))
]);

addExam({
  code: 'SOIT-MAIN-PK-01',
  title: 'Mains PK Full Mock 01',
  description: 'Professional Knowledge objective — the paper that actually makes the merit list. Mixed DBMS, Networks, OS, DSA, SE, OOP, Cyber, COA.',
  exam_family: 'IBPS_SO_IT',
  stage: 'mains',
  type: 'full',
  subject: 'Professional Knowledge',
  duration_sec: 30 * 60,
  marks_per_q: 2,
  negative_per_q: 0.5,
  difficulty: 'hard',
  max_hints: 5,
  instructions: mainsInstructions
}, [{ name: 'Professional Knowledge', duration_sec: 30 * 60 }], [
  ...dbms.slice(0, 6).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'DBMS', marks: 2, neg: 0.5 })),
  ...nets.slice(0, 5).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'Networks', marks: 2, neg: 0.5 })),
  ...os.slice(0, 4).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'OS', marks: 2, neg: 0.5 })),
  ...dsa.slice(0, 3).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'DSA', marks: 2, neg: 0.5 })),
  ...se.slice(0, 2).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'SE', marks: 2, neg: 0.5 })),
  ...oop.slice(0, 2).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'OOP', marks: 2, neg: 0.5 })),
  ...cyber.slice(0, 2).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'Cyber', marks: 2, neg: 0.5 })),
  ...coa.slice(0, 2).map((q) => ({ ...q, section: 'Professional Knowledge', subject: 'COA', marks: 2, neg: 0.5 }))
]);

function subjectExam(code, title, subject, desc, qs, minutes, hints, diff) {
  addExam({
    code, title, description: desc, exam_family: 'IBPS_SO_IT', stage: 'mains', type: 'subject',
    subject, duration_sec: minutes * 60, marks_per_q: 1, negative_per_q: 0.25, difficulty: diff || 'moderate',
    max_hints: hints, instructions: `Subject drill — ${subject}. Negative marking 0.25. Hints capped at ${hints} for this paper (coach can raise this live).`
  }, [{ name: subject, duration_sec: minutes * 60 }], qs.map((q) => ({ ...q, section: subject, subject })));
}

subjectExam('SOIT-SUB-DBMS', 'DBMS — Subject Drill', 'DBMS',
  'Normalization, SQL, transactions, indexing. Highest-yield PK topic (15–20 marks in mains).', dbms, 15, 4, 'moderate');
subjectExam('SOIT-SUB-NET', 'Computer Networks — Subject Drill', 'Networks',
  'OSI, TCP/IP, subnetting, routing, devices. Second-highest PK cluster.', nets, 15, 3, 'moderate');
subjectExam('SOIT-SUB-OS', 'Operating Systems — Subject Drill', 'OS',
  'Scheduling, deadlock, paging, sync, disk. Non-negotiable mains cluster.', os, 15, 3, 'moderate');
subjectExam('SOIT-SUB-DSA', 'Data Structures & Algorithms — Subject Drill', 'DSA',
  'Sorting, trees, graphs, hashing, heaps. Typical 6–8 mark slice.', dsa, 12, 3, 'moderate');
subjectExam('SOIT-SUB-SE', 'Software Engineering — Subject Drill', 'Software Engineering',
  'SDLC, Agile, testing, cohesion/coupling, cyclomatic complexity.', se, 10, 2, 'easy');
subjectExam('SOIT-SUB-OOP', 'OOP & Programming — Subject Drill', 'OOP',
  'Polymorphism, encapsulation, Java/C++ specifics, has-a vs is-a.', oop, 8, 2, 'easy');
subjectExam('SOIT-SUB-CYB', 'Cyber Security — Subject Drill', 'Cyber Security',
  'CIA triad, AES, signatures, injection, phishing, firewalls.', cyber, 8, 2, 'easy');
subjectExam('SOIT-SUB-COA', 'Computer Organisation — Subject Drill', 'COA',
  'Adders, pipeline, cache write policies, PC, RAID, endianness.', coa, 8, 2, 'moderate');
subjectExam('SOIT-SUB-WEB', 'Web Technologies — Subject Drill', 'Web Tech',
  'HTTP codes, REST, cookies, JSON — the 3–5 mark tail of PK.', web, 6, 2, 'easy');
subjectExam('SOIT-SUB-ENG', 'English Language — Prelims Drill', 'English',
  'Grammar, vocab, idioms, spelling. 25 marks / 20 minutes in the real prelims.', eng, 10, 2, 'easy');
subjectExam('SOIT-SUB-REA', 'Reasoning — Prelims Drill', 'Reasoning',
  'Syllogism, blood relation, coding-decoding, odd-one, calendar.', reas, 10, 2, 'moderate');
subjectExam('SOIT-SUB-QA', 'Quantitative Aptitude — Prelims Drill', 'Quant',
  'SI/CI, average, TSD, percentage, ratio, work, series.', quant, 10, 2, 'moderate');

addExam({
  code: 'SOIT-HI-DBMS',
  title: 'High Influence · DBMS Full Paper',
  description: 'A full-length DBMS paper. In mains PK, DBMS alone is 15–20 marks — treat this like a mini-mains.',
  exam_family: 'IBPS_SO_IT', stage: 'mains', type: 'high_influence', subject: 'DBMS',
  duration_sec: 18 * 60, marks_per_q: 2, negative_per_q: 0.5, difficulty: 'hard', max_hints: 4,
  instructions: 'High-influence paper. Every question is 2 marks. Coach can raise hints mid-exam without restarting.'
}, [{ name: 'DBMS', duration_sec: 18 * 60 }], dbms.map((q) => ({ ...q, section: 'DBMS', subject: 'DBMS', marks: 2, neg: 0.5 })));

addExam({
  code: 'SOIT-HI-NET',
  title: 'High Influence · Networks Full Paper',
  description: 'Full Networks paper — OSI to NAT. Second-biggest PK cluster in IBPS SO IT mains.',
  exam_family: 'IBPS_SO_IT', stage: 'mains', type: 'high_influence', subject: 'Networks',
  duration_sec: 18 * 60, marks_per_q: 2, negative_per_q: 0.5, difficulty: 'hard', max_hints: 4,
  instructions: 'High-influence paper. 2 marks a question, −0.5 wrong.'
}, [{ name: 'Networks', duration_sec: 18 * 60 }], nets.map((q) => ({ ...q, section: 'Networks', subject: 'Networks', marks: 2, neg: 0.5 })));

addExam({
  code: 'SOIT-HI-OS',
  title: 'High Influence · Operating Systems Full Paper',
  description: 'Deadlock, paging, scheduling, sync — the third pillar of PK. Sit this before any full mains mock.',
  exam_family: 'IBPS_SO_IT', stage: 'mains', type: 'high_influence', subject: 'OS',
  duration_sec: 18 * 60, marks_per_q: 2, negative_per_q: 0.5, difficulty: 'hard', max_hints: 3,
  instructions: 'High-influence OS paper. Finish with 80%+ before you touch mixed PK.'
}, [{ name: 'OS', duration_sec: 18 * 60 }], os.map((q) => ({ ...q, section: 'OS', subject: 'OS', marks: 2, neg: 0.5 })));

addExam({
  code: 'SOIT-HI-YIELD',
  title: 'High Influence · DBMS + Networks + OS',
  description: 'The three non-negotiable PK subjects in one sitting. If you only take one high-influence paper this week, take this.',
  exam_family: 'IBPS_SO_IT', stage: 'mains', type: 'high_influence', subject: 'High Yield Mix',
  duration_sec: 22 * 60, marks_per_q: 2, negative_per_q: 0.5, difficulty: 'hard', max_hints: 5,
  allow_section_switch: 1,
  instructions: 'Three sections, switch freely. This mix is ~60% of a typical PK paper.'
}, [
  { name: 'DBMS', duration_sec: 8 * 60 },
  { name: 'Networks', duration_sec: 7 * 60 },
  { name: 'OS', duration_sec: 7 * 60 }
], [
  ...dbms.slice(0, 8).map((q) => ({ ...q, section: 'DBMS', subject: 'DBMS', marks: 2, neg: 0.5 })),
  ...nets.slice(0, 7).map((q) => ({ ...q, section: 'Networks', subject: 'Networks', marks: 2, neg: 0.5 })),
  ...os.slice(0, 7).map((q) => ({ ...q, section: 'OS', subject: 'OS', marks: 2, neg: 0.5 }))
]);

// Coming-soon families as unpublished-looking published=1 coming_soon exams? We used coming_soon on exams table
db.prepare(`
  INSERT INTO exams (code, title, description, exam_family, stage, type, subject, duration_sec, coming_soon, is_published)
  VALUES
  ('SEBI-P1-01', 'SEBI Grade A Phase 1 Mock 01', 'Unlocks when the SEBI bank is imported.', 'SEBI_GRADE_A', 'phase1', 'full', null, 7200, 1, 0),
  ('NABARD-PRE-01', 'NABARD Grade A Prelims Mock 01', 'Unlocks when the NABARD bank is imported.', 'NABARD_GRADE_A', 'prelims', 'full', null, 7200, 1, 0)
`).run();

// Sample submitted attempts so analytics/leaderboard aren't empty
const demo = db.prepare("SELECT id FROM users WHERE email = 'demo@aaroh.in'").get();
const diya = db.prepare("SELECT id FROM users WHERE email = 'diya@aaroh.in'").get();
const kabir = db.prepare("SELECT id FROM users WHERE email = 'kabir@aaroh.in'").get();
const ananya = db.prepare("SELECT id FROM users WHERE email = 'ananya@aaroh.in'").get();
const someExams = db.prepare("SELECT id, duration_sec FROM exams WHERE coming_soon = 0").all();

function fakeAttempt(userId, examId, score, acc) {
  const qs = db.prepare('SELECT id, correct, marks FROM questions WHERE exam_id = ?').all(examId);
  const answers = {};
  qs.forEach((q, i) => {
    if (i % 5 === 0) return;
    answers[q.id] = { option: i % 7 === 0 ? (q.correct === 'a' ? 'b' : 'a') : q.correct, timeSpent: 20 + (i * 3) % 40 };
  });
  db.prepare(`
    INSERT INTO attempts (user_id, exam_id, status, started_at, submitted_at, duration_sec, answers_json, score, max_score, correct_count, wrong_count, skipped_count, accuracy, hints_used)
    VALUES (?, ?, 'submitted', datetime('now', '-2 days'), datetime('now', '-2 days', '+20 minutes'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, examId, 1200, JSON.stringify(answers), score, qs.reduce((s, q) => s + q.marks, 0), Math.round(qs.length * acc / 100), Math.round(qs.length * 0.15), Math.round(qs.length * 0.1), acc, 1);
}
if (someExams[0]) fakeAttempt(diya.id, someExams[0].id, 18, 72);
if (someExams[1]) fakeAttempt(kabir.id, someExams[1].id, 14, 61);
if (someExams[2]) fakeAttempt(ananya.id, someExams[2].id, 22, 80);
if (someExams[3]) fakeAttempt(demo.id, someExams[3].id, 16, 68);

const csv = `exam_code,exam_title,exam_type,exam_family,subject,duration_min,marks_per_q,negative,max_hints,question,option_a,option_b,option_c,option_d,correct,explanation,hint,topic,difficulty
SOIT-IMP-CLOUD,Cloud Computing — Subject Drill,subject,IBPS_SO_IT,Cloud,8,1,0.25,2,IaaS provides,Applications,Runtime only,Virtual machines and raw compute,Office 365,c,IaaS is infrastructure: VMs, storage, networks.,Think AWS EC2 vs Gmail.,Cloud,easy
SOIT-IMP-CLOUD,Cloud Computing — Subject Drill,subject,IBPS_SO_IT,Cloud,8,1,0.25,2,Which is a PaaS offering?,Gmail,Heroku / Google App Engine,Dropbox consumer,A hardware firewall,b,PaaS gives you a platform to deploy code.,App engine / Heroku are classic PaaS.,Cloud,easy
SOIT-IMP-CLOUD,Cloud Computing — Subject Drill,subject,IBPS_SO_IT,Cloud,8,1,0.25,2,Public cloud is characterised by,On-prem hardware only,Shared multi-tenant infrastructure over the internet,Air-gapped SCIF,A single company LAN,b,Public cloud is shared off-premises infrastructure.,Opposite of private on-prem.,Cloud,easy
`;
fs.writeFileSync(path.join(__dirname, 'data', 'sample-import.csv'), csv);

const sampleJson = {
  exam: {
    code: 'SOIT-IMP-AI',
    title: 'Emerging Tech — AI/ML Drill',
    type: 'subject',
    exam_family: 'IBPS_SO_IT',
    subject: 'Emerging Tech',
    duration_min: 6,
    marks_per_q: 1,
    negative: 0.25,
    max_hints: 2
  },
  questions: [
    {
      q_en: 'In supervised learning, the training data includes',
      option_a: 'Only unlabelled examples',
      option_b: 'Input–output pairs (labels)',
      option_c: 'Rewards from an environment only',
      option_d: 'No data at all',
      correct: 'b',
      hint: 'Teacher provides the right answer.',
      explanation: 'Supervised learning trains on labelled pairs (x, y). Unlabelled is unsupervised; rewards are reinforcement.',
      topic: 'ML'
    },
    {
      q_en: 'Overfitting means the model',
      option_a: 'Performs well on train and test',
      option_b: 'Memorises train data and generalises poorly',
      option_c: 'Underuses capacity',
      option_d: 'Cannot fit even the training set',
      correct: 'b',
      hint: 'Great on homework, fails the exam.',
      explanation: 'Overfit models capture noise in the training set and drop on unseen data.',
      topic: 'ML'
    }
  ]
};
fs.writeFileSync(path.join(__dirname, 'data', 'sample-import.json'), JSON.stringify(sampleJson, null, 2));

console.log('Seeded Aaroh.');
console.log('Admin   admin@aaroh.in  / Aaroh@123');
console.log('Student demo@aaroh.in   / Aaroh@123');
