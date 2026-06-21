#!/bin/sh
set -e

if [ ! -f /app/data/waitlist.db ]; then
    echo "数据库不存在，正在初始化演示数据..."
    node seed.js
    echo "演示数据初始化完成！"
else
    echo "数据库已存在，跳过初始化"
fi

exec "$@"
