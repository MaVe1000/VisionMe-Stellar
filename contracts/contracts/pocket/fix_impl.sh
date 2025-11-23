#!/bin/bash
cp src/lib.rs src/lib.rs.backup
head -n 200 src/lib.rs > src/lib.rs.tmp
sed -n '203,399p' src/lib.rs >> src/lib.rs.tmp
echo "}" >> src/lib.rs.tmp
mv src/lib.rs.tmp src/lib.rs
sed -i 's/allocation\.amount/allocation.total_amount/g' src/lib.rs
echo "✅ Corregido"
