#!/bin/bash
# Module 2 - Quick Start Script
# Run this to start the full application with Module 2 enabled

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  SQL File Reconcile Tool - Module 2 (SQL-to-SQL)              ║"
echo "║  Quick Start Script                                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}Step 1: Checking Prerequisites${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Python
if ! command -v python &> /dev/null; then
    echo -e "${YELLOW}⚠ Python not found${NC}"
    exit 1
fi
python --version

# Check Node
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}⚠ Node/npm not found${NC}"
    exit 1
fi
npm --version

echo ""
echo -e "${BLUE}Step 2: Verify Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f "backend/db_config.json" ]; then
    echo -e "${YELLOW}⚠ backend/db_config.json not found${NC}"
    echo "  Create this file with your database environments"
    exit 1
fi
echo -e "${GREEN}✓ db_config.json found${NC}"

echo ""
echo -e "${BLUE}Step 3: Install Backend Dependencies${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd backend
pip install -q -r requirements.txt
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
cd ..

echo ""
echo -e "${BLUE}Step 4: Install Frontend Dependencies${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd frontend
npm install -q
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
cd ..

echo ""
echo -e "${BLUE}Step 5: Starting Application${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo -e "${GREEN}Opening in two terminals...${NC}"
echo ""
echo "📌 Backend Server:"
echo "   Command: cd backend && python app.py"
echo "   URL: http://localhost:5000"
echo ""
echo "📌 Frontend Server:"
echo "   Command: cd frontend && npm start"
echo "   URL: http://localhost:3000"
echo ""

# Instructions for manual startup
echo -e "${YELLOW}Manual Startup (in two separate terminal windows):${NC}"
echo ""
echo "Terminal 1 - Backend:"
echo "  $ cd backend"
echo "  $ python app.py"
echo ""
echo "Terminal 2 - Frontend:"
echo "  $ cd frontend"
echo "  $ npm start"
echo ""
echo -e "${GREEN}Then navigate to: http://localhost:3000${NC}"
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Module 2 Workflow:                                           ║"
echo "║  1. Select sidebar → SQL to SQL                              ║"
echo "║  2. Tab 1: Select Source & Target environments               ║"
echo "║  3. Tab 2: Enter two SQL queries & preview results           ║"
echo "║  4. Tab 3: Select primary key columns                        ║"
echo "║  5. Tab 4: Run comparison & download results                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
