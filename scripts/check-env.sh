#!/bin/bash

###############################################################################
# Slide Forge - 环境检查脚本
# 验证所有必需的配置和依赖是否正确设置
###############################################################################

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Slide Forge Environment Check         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0
WARNINGS=0

# 检查 Node.js
echo -n "🟢 Node.js: "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}$NODE_VERSION ✓${NC}"
else
    echo -e "${RED}Not installed ✗${NC}"
    ((ERRORS++))
fi

# 检查 pnpm
echo -n "🟢 pnpm: "
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    echo -e "${GREEN}v$PNPM_VERSION ✓${NC}"
else
    echo -e "${YELLOW}Not installed (will use npm)${NC}"
    ((WARNINGS++))
fi

# 检查 PostgreSQL
echo -n "🟢 PostgreSQL: "
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version | awk '{print $3}')
    echo -e "${GREEN}$PG_VERSION ✓${NC}"
else
    echo -e "${YELLOW}Not detected (remote DB ok)${NC}"
    ((WARNINGS++))
fi

# 检查 .env.local
echo ""
echo -e "${BLUE}Configuration Files:${NC}"
echo -n "  📄 .env.local: "
if [ -f ".env.local" ]; then
    echo -e "${GREEN}Exists ✓${NC}"

    # 检查关键配置
    echo ""
    echo -e "${BLUE}Environment Variables:${NC}"

    # DATABASE_URL
    echo -n "  🗄️  DATABASE_URL: "
    if grep -q 'DATABASE_URL=""' .env.local || ! grep -q "DATABASE_URL=" .env.local; then
        echo -e "${RED}Not configured ✗${NC}"
        ((ERRORS++))
    else
        echo -e "${GREEN}Configured ✓${NC}"
    fi

    # NEXTAUTH_SECRET
    echo -n "  🔐 NEXTAUTH_SECRET: "
    if grep -q 'NEXTAUTH_SECRET=""' .env.local || ! grep -q "NEXTAUTH_SECRET=" .env.local; then
        echo -e "${RED}Not configured ✗${NC}"
        ((ERRORS++))
    else
        echo -e "${GREEN}Configured ✓${NC}"
    fi

    # UNSPLASH_ACCESS_KEY
    echo -n "  🖼️  UNSPLASH_ACCESS_KEY: "
    if grep -q 'UNSPLASH_ACCESS_KEY=""' .env.local || ! grep -q "UNSPLASH_ACCESS_KEY=" .env.local; then
        echo -e "${YELLOW}Not configured (auto-images disabled)${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}Configured ✓${NC}"
    fi

    # AWS Credentials
    echo -n "  ☁️  AWS_ACCESS_KEY_ID: "
    if grep -q 'AWS_ACCESS_KEY_ID=""' .env.local || ! grep -q "AWS_ACCESS_KEY_ID=" .env.local; then
        echo -e "${YELLOW}Not configured (Agent may not work)${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}Configured ✓${NC}"
    fi

else
    echo -e "${RED}Not found ✗${NC}"
    ((ERRORS++))
fi

# 检查依赖
echo ""
echo -e "${BLUE}Dependencies:${NC}"
echo -n "  📦 node_modules: "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}Installed ✓${NC}"
else
    echo -e "${RED}Not installed ✗${NC}"
    ((ERRORS++))
fi

# 检查 Prisma Client
echo -n "  🗃️  Prisma Client: "
if [ -d "node_modules/.prisma/client" ] || [ -d "node_modules/@prisma/client" ]; then
    echo -e "${GREEN}Generated ✓${NC}"
else
    echo -e "${YELLOW}Not generated${NC}"
    ((WARNINGS++))
fi

# 总结
echo ""
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! You're ready to start.${NC}"
    echo ""
    echo "Run: ./start.sh"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) detected.${NC}"
    echo "You can start the app, but some features may be limited."
    echo ""
    echo "Run: ./start.sh"
else
    echo -e "${RED}❌ $ERRORS error(s) detected.${NC}"
    echo "Please fix the errors above before starting."
    echo ""
    echo "Run: ./install.sh"
fi

echo ""

exit $ERRORS
