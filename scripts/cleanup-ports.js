#!/usr/bin/env node

/**
 * 포트 정리 스크립트
 * 개발 서버 시작 전에 기존에 사용 중인 포트들을 정리합니다.
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// 정리할 포트 목록 (3000-3010 범위)
const PORTS_TO_CLEANUP = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

async function findProcessOnPort(port) {
  try {
    // Windows에서 포트를 사용하는 프로세스 찾기
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    
    if (!stdout.trim()) {
      return null;
    }

    // 출력에서 PID 추출
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pids.add(pid);
        }
      }
    }

    return Array.from(pids);
  } catch (error) {
    return null;
  }
}

async function killProcess(pid) {
  try {
    await execAsync(`taskkill /F /PID ${pid}`);
    return true;
  } catch (error) {
    console.warn(`⚠️  PID ${pid} 종료 실패:`, error.message);
    return false;
  }
}

async function getProcessName(pid) {
  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
    const line = stdout.trim().split('\n')[0];
    if (line) {
      const name = line.split(',')[0].replace(/"/g, '');
      return name;
    }
  } catch (error) {
    return `PID ${pid}`;
  }
  return `PID ${pid}`;
}

async function cleanupPorts() {
  console.log('🧹 개발 서버 포트 정리 시작...\n');

  let totalKilled = 0;

  for (const port of PORTS_TO_CLEANUP) {
    console.log(`🔍 포트 ${port} 확인 중...`);
    
    const pids = await findProcessOnPort(port);
    
    if (!pids || pids.length === 0) {
      console.log(`✅ 포트 ${port}은 사용 가능합니다.`);
      continue;
    }

    console.log(`🚨 포트 ${port}에서 ${pids.length}개의 프로세스 발견:`);
    
    for (const pid of pids) {
      const processName = await getProcessName(pid);
      console.log(`   - ${processName} (PID: ${pid})`);
      
      // Next.js 개발 서버나 Node.js 프로세스인 경우에만 종료
      if (processName.toLowerCase().includes('node') || 
          processName.toLowerCase().includes('next')) {
        
        const success = await killProcess(pid);
        if (success) {
          console.log(`   ✅ ${processName} (PID: ${pid}) 종료 완료`);
          totalKilled++;
        }
      } else {
        console.log(`   ⏭️  ${processName} (PID: ${pid}) 건너뜀 (Node.js 프로세스가 아님)`);
      }
    }
    
    console.log(''); // 빈 줄 추가
  }

  if (totalKilled > 0) {
    console.log(`🎉 총 ${totalKilled}개의 프로세스를 정리했습니다.`);
    console.log('⏳ 포트 해제를 위해 2초 대기 중...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  } else {
    console.log('✨ 정리할 프로세스가 없습니다.\n');
  }

  // 최종 포트 3000 확인
  console.log('🎯 포트 3000 최종 확인...');
  const finalCheck = await findProcessOnPort(3000);
  
  if (!finalCheck || finalCheck.length === 0) {
    console.log('✅ 포트 3000이 사용 가능합니다!');
    console.log('🚀 개발 서버를 시작할 수 있습니다.\n');
  } else {
    console.log('⚠️  포트 3000이 여전히 사용 중입니다.');
    console.log('   수동으로 확인이 필요할 수 있습니다.\n');
  }
}

// 스크립트 실행
if (require.main === module) {
  cleanupPorts().catch(error => {
    console.error('❌ 포트 정리 중 오류 발생:', error.message);
    process.exit(1);
  });
}

module.exports = { cleanupPorts };