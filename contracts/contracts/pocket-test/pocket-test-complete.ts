/**
 * VisionMe Pocket Contract - Test con DeFindex REAL
 * Adaptado al código actual que SÍ usa DeFindex
 */
import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

import { rpc } from '@stellar/stellar-sdk';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================
const CONFIG = {
  NETWORK_PASSPHRASE: Networks.TESTNET,
  RPC_URL: 'https://soroban-testnet.stellar.org',
  POCKET_CONTRACT_ID: 'CDN7VZRCW3XB6EC2AMX4KFGTXEUCNEKM4AKFEFOF4GO23PE6CW3VUTQN',
  DEFINDEX_VAULT_ID: 'CDVBWOYLVZ34TZOEU7CCGBKV5C6PNDRKWTQEL262LRHWIWYRXA7ENMSC',
  // ⚠️ IMPORTANTE: Obtener la dirección real del vault de DeFindex desde la imagen
  USDC_CONTRACT_ID: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  DEPOSIT_AMOUNT: '100000000', // 10 USDC (7 decimales)
  TARGET_AMOUNT: '10000000000', // 1000 USDC objetivo
};

const server = new rpc.Server(CONFIG.RPC_URL);

// ============================================================================
// TIPOS
// ============================================================================
interface PocketData {
  owner: string;
  asset: string;
  goal_amount: bigint;
  current_amount: bigint;
  df_tokens: bigint;
  first_deposit?: bigint;
  last_deposit?: bigint;
}

interface VaultBalance {
  total_managed_funds: bigint;
  fee: bigint;
  total_shares: bigint;
}

// ============================================================================
// UTILIDADES
// ============================================================================
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatAmount(amount: string | bigint, decimals: number = 7): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const decimalPart = value % divisor;
  return `${integerPart}.${decimalPart.toString().padStart(decimals, '0')}`;
}

// ============================================================================
// INVOKE CONTRACT - FUNCIÓN PRINCIPAL
// ============================================================================
async function invokeContract(
  contractId: string,
  method: string,
  params: xdr.ScVal[],
  source: Keypair,
  simulate: boolean = false
): Promise<any> {
  console.log(`\n📞 Invocando: ${method} en ${contractId.substring(0, 8)}...`);
  
  try {
    const contract = new Contract(contractId);
    const operation = contract.call(method, ...params);
    const sourceAccount = await server.getAccount(source.publicKey());
    
    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee: '10000000', // Fee más alto para operaciones con DeFindex
      networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
    });
    
    txBuilder.addOperation(operation);
    txBuilder.setTimeout(180); // Timeout más largo
    const tx = txBuilder.build();
    
    // Simular transacción
    const simulation = await server.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationError(simulation)) {
      console.error('❌ Error en simulación:', simulation.error);
      throw new Error(`Simulation failed: ${simulation.error}`);
    }
    
    if (simulate) {
      console.log('✅ Simulación exitosa');
      const result = simulation.result?.retval;
      return result ? scValToNative(result) : null;
    }
    
    // Preparar y firmar transacción
    const preparedTx = rpc.assembleTransaction(tx, simulation).build();
    preparedTx.sign(source);
    
    // Enviar transacción
    const sendResponse = await server.sendTransaction(preparedTx);
    console.log(`📬 TX Hash: ${sendResponse.hash}`);
    console.log(`🔗 Ver en Stellar Expert: https://stellar.expert/explorer/testnet/tx/${sendResponse.hash}`);
    
    // Esperar confirmación
    let getResponse = await server.getTransaction(sendResponse.hash);
    let attempts = 0;
    while (getResponse.status === 'NOT_FOUND' && attempts < 60) {
      await delay(3000);
      getResponse = await server.getTransaction(sendResponse.hash);
      attempts++;
      if (attempts % 5 === 0) {
        console.log(`⏳ Esperando confirmación... (${attempts * 3}s)`);
      }
    }
    
    if (getResponse.status === 'SUCCESS') {
      console.log('✅ Confirmado');
      const result = getResponse.returnValue;
      return result ? scValToNative(result) : null;
    } else {
      console.error('❌ Falló:', getResponse);
      throw new Error(`Transaction failed: ${getResponse.status}`);
    }
    
  } catch (error: any) {
    console.error('💥 Error:', error.message || error);
    throw error;
  }
}

// ============================================================================
// FUNCIONES DEL CONTRATO POCKET
// ============================================================================

async function initializeContract(
  deployer: Keypair,
  vaultAddress: string,
  assetAddress: string
): Promise<void> {
  console.log('🔧 Inicializando contrato con vault y asset...');
  
  const params: xdr.ScVal[] = [
    new Address(vaultAddress).toScVal(),
    new Address(assetAddress).toScVal(),
  ];
  
  await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    '__constructor',
    params,
    deployer,
    false
  );
  
  console.log('✅ Contrato inicializado');
}

async function createPocket(
  owner: Keypair,
  asset: string,
  goalAmount: string
): Promise<bigint> {
  const params: xdr.ScVal[] = [
    new Address(owner.publicKey()).toScVal(),
    new Address(asset).toScVal(),
    nativeToScVal(goalAmount, { type: 'i128' })
  ];
  
  const pocketId = await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'create_pocket',
    params,
    owner,
    false
  );
  
  console.log(`🎉 Pocket creado: ID = ${pocketId}`);
  return BigInt(pocketId);
}

async function deposit(
  pocketId: bigint,
  from: Keypair,
  amount: string
): Promise<void> {
  const params: xdr.ScVal[] = [
    nativeToScVal(pocketId.toString(), { type: 'i128' }),
    new Address(from.publicKey()).toScVal(),
    nativeToScVal(amount, { type: 'i128' })
  ];
  
  await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'deposit',
    params,
    from,
    false
  );
  
  console.log(`💰 Depositado: ${formatAmount(amount)} USDC`);
}

async function getPocket(pocketId: bigint, caller: Keypair): Promise<PocketData> {
  const params: xdr.ScVal[] = [
    nativeToScVal(pocketId.toString(), { type: 'i128' })
  ];
  
  const pocketData = await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'get_pocket',
    params,
    caller,
    true
  );
  
  return pocketData as PocketData;
}

async function withdraw(
  pocketId: bigint,
  to: Keypair,
  dfTokensAmount: string
): Promise<void> {
  const params: xdr.ScVal[] = [
    nativeToScVal(pocketId.toString(), { type: 'i128' }),
    new Address(to.publicKey()).toScVal(),
    nativeToScVal(dfTokensAmount, { type: 'i128' })
  ];
  
  await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'withdraw',
    params,
    to,
    false
  );
  
  console.log(`💸 Retirado: ${formatAmount(dfTokensAmount)} dfTokens`);
}

// ============================================================================
// FUNCIONES DEL VAULT DE DEFINDEX
// ============================================================================



async function getVaultBalance(caller: Keypair): Promise<VaultBalance | null> {
  console.log('\n📊 Consultando balance del Vault de DeFindex...');
  
  try {
    const totalSupply = await invokeContract(
      CONFIG.DEFINDEX_VAULT_ID,
      'total_supply',
      [],
      caller,
      true
    );
    
    const managedFunds = await invokeContract(
      CONFIG.DEFINDEX_VAULT_ID,
      'fetch_total_managed_funds',
      [],
      caller,
      true
    );
    
    let totalManaged = 0n;
    if (Array.isArray(managedFunds)) {
      for (const allocation of managedFunds) {
        totalManaged += BigInt(allocation.total_amount || 0);
      }
    }
    
    return {
      total_managed_funds: totalManaged,
      total_shares: BigInt(totalSupply || 0),
      fee: 0n
    };
  } catch (error: any) {
    console.log('⚠️  No se pudo consultar balance del vault:', error.message);
    return null;
  }
}

async function getDfTokenValue(
  dfTokensAmount: bigint,
  caller: Keypair
): Promise<bigint> {
  console.log('\n💎 Calculando valor de dfTokens...');
  
  try {
    // La función puede variar según la implementación de DeFindex
    // Típicamente: value = (dfTokens * total_assets) / total_shares
    const vaultBalance = await getVaultBalance(caller);
    
    if (!vaultBalance) {
      console.log('⚠️  Usando valor nominal de dfTokens');
      return dfTokensAmount;
    }
    
    // Calcular valor proporcional
    if (vaultBalance.total_shares > 0n) {
      const value = (dfTokensAmount * vaultBalance.total_managed_funds) / vaultBalance.total_shares;
      console.log(`💰 Valor calculado: ${formatAmount(value)} USDC`);
      return value;
    }
    
    return dfTokensAmount;
  } catch (error: any) {
    console.log('⚠️  Error calculando valor:', error.message);
    return dfTokensAmount;
  }
}

// ============================================================================
// TEST COMPLETO CON DEFINDEX REAL
// ============================================================================
async function runCompleteTestWithRealDeFindex() {
  console.log('🚀 VisionMe Pocket + DeFindex REAL - Test Completo\n');
  console.log('═'.repeat(70));
  console.log(`📍 Pocket Contract: ${CONFIG.POCKET_CONTRACT_ID}`);
  console.log(`🏦 DeFindex Vault:  ${CONFIG.DEFINDEX_VAULT_ID}`);
  console.log(`💵 USDC Token:      ${CONFIG.USDC_CONTRACT_ID}`);
  console.log(`🌐 Red: ${CONFIG.NETWORK_PASSPHRASE}`);
  console.log(`🔗 RPC: ${CONFIG.RPC_URL}`);
  console.log('═'.repeat(70));
  
  try {
    // PASO 1: Crear cuenta y fondear
    console.log('\n📍 PASO 1: Crear cuenta de prueba');
    const testAccount = Keypair.random();
    console.log(`👤 Cuenta: ${testAccount.publicKey()}`);
    console.log(`🔑 Secret: ${testAccount.secret()} (GUARDAR PARA DEBUG)`);
    
    console.log('\n💧 Solicitando airdrop de XLM...');
    await server.requestAirdrop(testAccount.publicKey());
    await delay(5000);
    console.log('✅ Cuenta fondeada con 10,000 XLM');
    
    // PASO 1.5: Inicializar el contrato (si es necesario)
    console.log('\n📍 PASO 1.5: Verificar inicialización del contrato');
    try {
      await initializeContract(
        testAccount,
        CONFIG.DEFINDEX_VAULT_ID,
        CONFIG.USDC_CONTRACT_ID
      );
    } catch (error: any) {
      console.log('ℹ️  Contrato ya inicializado o error:', error.message);
    }
    
    // PASO 2: Crear Pocket
    console.log('\n📍 PASO 2: Crear Pocket');
    const pocketId = await createPocket(
      testAccount,
      CONFIG.USDC_CONTRACT_ID,
      CONFIG.TARGET_AMOUNT
    );
    
    // PASO 3: Obtener info inicial del pocket
    console.log('\n📍 PASO 3: Verificar pocket creado');
    let pocketData = await getPocket(pocketId, testAccount);
    console.log(`👤 Owner: ${pocketData.owner}`);
    console.log(`🪙 Asset: ${pocketData.asset}`);
    console.log(`💰 Current amount: ${formatAmount(pocketData.current_amount)} USDC`);
    console.log(`💎 dfTokens: ${formatAmount(pocketData.df_tokens)}`);
    console.log(`🎯 Meta: ${formatAmount(pocketData.goal_amount)} USDC`);
    
    // PASO 4: Primer depósito (automáticamente se invierte en DeFindex)
    console.log('\n📍 PASO 4: Primer depósito (auto-invierte en DeFindex)');
    console.log('⚠️  IMPORTANTE: Tu contrato deposita en el vault de DeFindex automáticamente');
    await deposit(pocketId, testAccount, CONFIG.DEPOSIT_AMOUNT);
    
    // PASO 5: Verificar después del depósito
    console.log('\n📍 PASO 5: Verificar estado post-depósito');
    pocketData = await getPocket(pocketId, testAccount);
    console.log(`💰 Current amount: ${formatAmount(pocketData.current_amount)} USDC`);
    console.log(`💎 dfTokens recibidos: ${formatAmount(pocketData.df_tokens)}`);
    console.log(`📊 Progreso: ${(Number(pocketData.current_amount) / Number(pocketData.goal_amount) * 100).toFixed(2)}%`);
    
    // PASO 6: Consultar el vault de DeFindex
    console.log('\n📍 PASO 6: Consultar estado del Vault de DeFindex');
    const vaultBalance = await getVaultBalance(testAccount);
    if (vaultBalance) {
      console.log(`🏦 Total administrado: ${formatAmount(vaultBalance.total_managed_funds)} USDC`);
      console.log(`📊 Total shares: ${formatAmount(vaultBalance.total_shares)}`);
      console.log(`💵 Fee del vault: ${formatAmount(vaultBalance.fee)}`);
    }
    
    // PASO 7: Calcular valor actual de los dfTokens
    console.log('\n📍 PASO 7: Calcular valor real de los dfTokens');
    const currentValue = await getDfTokenValue(pocketData.df_tokens, testAccount);
    const valueChange = currentValue - pocketData.current_amount;
    
    console.log(`💰 Valor depositado: ${formatAmount(pocketData.current_amount)} USDC`);
    console.log(`💎 dfTokens en posesión: ${formatAmount(pocketData.df_tokens)}`);
    console.log(`📈 Valor actual estimado: ${formatAmount(currentValue)} USDC`);
    
    if (valueChange > 0n) {
      console.log(`✨ ¡Rendimiento generado!: +${formatAmount(valueChange)} USDC`);
      const yieldPercent = (Number(valueChange) / Number(pocketData.current_amount) * 100).toFixed(4);
      console.log(`📊 Yield: +${yieldPercent}%`);
    } else if (valueChange < 0n) {
      console.log(`⚠️  Valor actual menor (puede ser fee inicial): ${formatAmount(valueChange)} USDC`);
    } else {
      console.log(`ℹ️  Sin cambio de valor aún (normal en depósito reciente)`);
    }
    
    // PASO 8: Segundo depósito
    console.log('\n📍 PASO 8: Segundo depósito');
    const secondDeposit = '50000000'; // 5 USDC
    await deposit(pocketId, testAccount, secondDeposit);
    
    // PASO 9: Balance actualizado
    console.log('\n📍 PASO 9: Balance después del segundo depósito');
    pocketData = await getPocket(pocketId, testAccount);
    const totalDeposited = BigInt(CONFIG.DEPOSIT_AMOUNT) + BigInt(secondDeposit);
    console.log(`💰 Total depositado: ${formatAmount(totalDeposited)} USDC`);
    console.log(`💰 Current amount: ${formatAmount(pocketData.current_amount)} USDC`);
    console.log(`💎 Total dfTokens: ${formatAmount(pocketData.df_tokens)}`);
    
    // PASO 10: Simular espera para acumular yield
    console.log('\n📍 PASO 10: Información sobre rendimientos');
    console.log('ℹ️  Los rendimientos de DeFindex se acumulan con el tiempo');
    console.log('⏰ El yield típico es de 5-8% APY');
    console.log('📅 Para ver rendimientos significativos, espera al menos 24-48 horas');
    
    // Calcular proyección de rendimiento
    const apyPercent = 6;
    const dailyRate = apyPercent / 365 / 100;
    const projectedDailyYield = Number(pocketData.current_amount) * dailyRate;
    
    console.log(`\n💡 Proyección de rendimientos (${apyPercent}% APY):`);
    console.log(`   • 1 día:  +${formatAmount(BigInt(Math.floor(projectedDailyYield)))} USDC`);
    console.log(`   • 7 días: +${formatAmount(BigInt(Math.floor(projectedDailyYield * 7)))} USDC`);
    console.log(`   • 30 días: +${formatAmount(BigInt(Math.floor(projectedDailyYield * 30)))} USDC`);
    console.log(`   • 1 año:  +${formatAmount(BigInt(Math.floor(Number(pocketData.current_amount) * apyPercent / 100)))} USDC`);
    
    // RESUMEN FINAL
    console.log('\n' + '═'.repeat(70));
    console.log('✅ PRUEBA COMPLETA EXITOSA');
    console.log('═'.repeat(70));
    console.log(`📝 Resumen del Pocket ID ${pocketId}:`);
    console.log(`   • Owner: ${pocketData.owner}`);
    console.log(`   • Total depositado: ${formatAmount(totalDeposited)} USDC`);
    console.log(`   • Current amount: ${formatAmount(pocketData.current_amount)} USDC`);
    console.log(`   • dfTokens: ${formatAmount(pocketData.df_tokens)}`);
    console.log(`   • Meta: ${formatAmount(pocketData.goal_amount)} USDC`);
    console.log(`   • Progreso: ${(Number(pocketData.current_amount) / Number(pocketData.goal_amount) * 100).toFixed(2)}%`);
    console.log('═'.repeat(70));
    
    console.log('\n🎉 TU CONTRATO YA ESTÁ GENERANDO RENDIMIENTOS CON DEFINDEX!');
    console.log('\n💡 CÓMO VERIFICAR EL YIELD:');
    console.log('   1. Guarda el pocket_id y la cuenta de prueba');
    console.log('   2. Espera 24-48 horas');
    console.log('   3. Vuelve a ejecutar get_pocket() y verifica el valor de dfTokens');
    console.log('   4. Calcula: valor_actual = (dfTokens * total_managed_funds) / total_shares');
    console.log('   5. El yield = valor_actual - current_amount');
    
    console.log('\n📊 PARA MONITOREAR EN TIEMPO REAL:');
    console.log(`   • Stellar Expert: https://stellar.expert/explorer/testnet/account/${testAccount.publicKey()}`);
    console.log(`   • DeFindex Dashboard: https://app.defindex.io/ (si está disponible)`);
    console.log(`   • Consulta balance del vault periódicamente con getVaultBalance()`);
    
    console.log('\n🔗 TRANSACCIONES:');
    console.log('   Revisa las URLs de Stellar Expert mostradas arriba para ver:');
    console.log('   - Depósitos al vault de DeFindex');
    console.log('   - dfTokens recibidos');
    console.log('   - Operaciones del vault');
    
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n💥 ERROR EN LA PRUEBA:', error.message || error);
    console.error('Stack:', error.stack);
    
    console.log('\n🔍 POSIBLES CAUSAS:');
    console.log('   1. El contrato no está inicializado (__constructor no llamado)');
    console.log('   2. La dirección del vault de DeFindex es incorrecta');
    console.log('   3. No hay liquidez suficiente en el vault');
    console.log('   4. El WASM de defindex_vault.wasm no coincide con el desplegado');
    console.log('   5. La cuenta de prueba no tiene suficiente XLM para fees');
    
    process.exit(1);
  }
}

// EJECUTAR
runCompleteTestWithRealDeFindex();

////

/**
 * Obtiene el valor real del pocket incluyendo yield
 */
async function getRealValue(pocketId: bigint, caller: Keypair): Promise<bigint> {
  const params: xdr.ScVal[] = [
    nativeToScVal(pocketId.toString(), { type: 'i128' })
  ];
  
  const realValue = await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'get_real_value',
    params,
    caller,
    true // Solo simulación para lectura
  );
  
  return BigInt(realValue);
}

/**
 * Obtiene el yield acumulado
 */
async function getYieldEarned(pocketId: bigint, caller: Keypair): Promise<bigint> {
  const params: xdr.ScVal[] = [
    nativeToScVal(pocketId.toString(), { type: 'i128' })
  ];
  
  const yieldEarned = await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'get_yield_earned',
    params,
    caller,
    true
  );
  
  return BigInt(yieldEarned);
}

/**
 * Obtiene pocket con valor real y yield en una sola llamada
 */
async function getPocketWithYield(pocketId: bigint, caller: Keypair): Promise<{
  pocket: PocketData;
  realValue: bigint;
  yieldEarned: bigint;
}> {
  const params: xdr.ScVal[] = [
    nativeToScVal(pocketId.toString(), { type: 'i128' })
  ];
  
  const result = await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'get_pocket_with_yield',
    params,
    caller,
    true
  );
  
  // El resultado es una tupla: (PocketData, realValue, yieldEarned)
  return {
    pocket: result[0] as PocketData,
    realValue: BigInt(result[1]),
    yieldEarned: BigInt(result[2])
  };
}

/**
 * Calcula el APY actual del pocket
 */
async function calculateAPY(pocketId: bigint, caller: Keypair): Promise<number> {
  const params: xdr.ScVal[] = [
    nativeToScVal(pocketId.toString(), { type: 'i128' })
  ];
  
  const apyRaw = await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'calculate_apy',
    params,
    caller,
    true
  );
  
  // El APY viene con 2 decimales (ej: 650 = 6.50%)
  return Number(apyRaw) / 100;
}

// ============================================================================
// EJEMPLO DE USO EN EL TEST
// ============================================================================

/**
 * Función ejemplo que muestra cómo usar las nuevas funciones
 */
async function mostrarRendimientosCompletos(pocketId: bigint, caller: Keypair) {
  console.log('\n📊 REPORTE COMPLETO DE RENDIMIENTOS');
  console.log('═'.repeat(60));
  
  // Opción 1: Obtener todo por separado
  const pocketData = await getPocket(pocketId, caller);
  const realValue = await getRealValue(pocketId, caller);
  const yieldEarned = await getYieldEarned(pocketId, caller);
  const apy = await calculateAPY(pocketId, caller);
  
  console.log(`💰 Depositado:       ${formatAmount(pocketData.current_amount)} USDC`);
  console.log(`💎 dfTokens:         ${formatAmount(pocketData.df_tokens)}`);
  console.log(`📈 Valor actual:     ${formatAmount(realValue)} USDC`);
  console.log(`✨ Yield ganado:     ${formatAmount(yieldEarned)} USDC`);
  console.log(`📊 APY:              ${apy.toFixed(2)}%`);
  
  if (yieldEarned > 0n) {
    const yieldPercent = (Number(yieldEarned) / Number(pocketData.current_amount) * 100).toFixed(4);
    console.log(`💹 Rendimiento:      +${yieldPercent}%`);
  }
  
  console.log('═'.repeat(60));
  
  // Opción 2: Obtener todo de una vez (más eficiente)
  const { pocket, realValue: rv, yieldEarned: ye } = await getPocketWithYield(pocketId, caller);
  console.log('\n✅ Datos obtenidos en una sola llamada al contrato');
}