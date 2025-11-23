/**
 * VisionMe Pocket Contract Tester - TypeScript Version
 * Versión corregida con imports v13+
 */
import {
  Account,
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

// ✅ Import correcto para versiones v13+
import { rpc } from '@stellar/stellar-sdk';

// ============================================================================ 
// CONFIGURACIÓN
// ============================================================================ 
const CONFIG = {
  NETWORK_PASSPHRASE: Networks.TESTNET,
  RPC_URL: 'https://soroban-testnet.stellar.org',
  POCKET_CONTRACT_ID: 'CCB4CCPGZHLMLJVA5IUGTDEVU7TSR5SKAMPU6D5X3HUXIJB5B3BHYVFF',
  // Genera una keypair de prueba o usa una existente
  SOURCE_SECRET: 'SAWADD3JIHN7XFM6BEZBJT2ZLX4E6GBHOD74B6FKARRTTLI6PL5CU4LT' // Reemplaza con tu secret key
};

// ============================================================================ 
// INICIALIZACIÓN
// ============================================================================ 
const server = new rpc.Server(CONFIG.RPC_URL);

// ============================================================================ 
// FUNCIÓN PRINCIPAL: INVOCAR CONTRATO
// ============================================================================ 
async function invokeContract(
  contractId: string,
  method: string,
  params: xdr.ScVal[],
  source: Keypair,
  sim: boolean = false
): Promise<any> {
  console.log(`📞 Invocando contrato ${contractId} - método: ${method}`);
  
  try {
    // 1. Crear la operación del contrato
    const contract = new Contract(contractId);
    const operation = contract.call(method, ...params);
    
    // 2. Obtener la cuenta source
    const sourceAccount = await server.getAccount(source.publicKey());
    
    // 3. Construir la transacción
    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee: '100000',
      networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
    });
    
    txBuilder.addOperation(operation);
    txBuilder.setTimeout(30);
    const tx = txBuilder.build();
    
    // 4. Simular la transacción
    console.log('🔄 Simulando transacción...');
    const simulation = await server.simulateTransaction(tx);
    
    // 5. Verificar errores de simulación
    if (!simulation) {
      console.error('❌ Error en simulación:', simulation);
      throw new Error(simulation);
    }
    
    // 6. Si solo queremos simular, retornar resultado
    if (sim) {
      console.log('✅ Simulación exitosa');
      return simulation;
    }
    
    // 7. Preparar la transacción con los resultados de la simulación
    console.log('📝 Preparando transacción...');
    const preparedTx = rpc.assembleTransaction(tx, simulation).build();
    
    // 8. Firmar la transacción
    preparedTx.sign(source);
    
    // 9. Enviar la transacción
    console.log('🚀 Enviando transacción...');
    const sendResponse = await server.sendTransaction(preparedTx);
    
    console.log('📬 Transacción enviada:', sendResponse.hash);
    
    // 10. Esperar confirmación
    let getResponse = await server.getTransaction(sendResponse.hash);
    while (getResponse.status === 'NOT_FOUND') {
      console.log('⏳ Esperando confirmación...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      getResponse = await server.getTransaction(sendResponse.hash);
    }
    
    console.log('✅ Transacción confirmada:', getResponse.status);
    
    // 11. Retornar resultado
    if (getResponse.status === 'SUCCESS') {
      const result = getResponse.returnValue;
      return result ? scValToNative(result) : null;
    } else {
      throw new Error(`Transaction failed: ${getResponse.status}`);
    }
    
  } catch (error) {
    console.error('💥 Error fatal:', error);
    throw error;
  }
}

// ============================================================================ 
// FUNCIONES DE PRUEBA PARA TU CONTRATO POCKET
// ============================================================================ 

async function testGetBalance(userId: string) {
  console.log('\n=== TEST: get_balance ===');
  const source = Keypair.fromSecret(CONFIG.SOURCE_SECRET);
  
  const params = [
    nativeToScVal(userId, { type: 'string' })
  ];
  
  const result = await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'balance',
    params,
    source,
    true // solo simular
  );
  
  console.log('Balance:', result);
  return result;
}

async function testAddFunds(userId: string, amount: number) {
  console.log('\n=== TEST: add_funds ===');
  const source = Keypair.fromSecret(CONFIG.SOURCE_SECRET);
  
  const params = [
    nativeToScVal(userId, { type: 'string' }),
    nativeToScVal(amount, { type: 'u64' })
  ];
  
  const result = await invokeContract(
    CONFIG.POCKET_CONTRACT_ID,
    'add_funds',
    params,
    source,
    false // ejecutar realmente
  );
  
  console.log('Fondos agregados:', result);
  return result;
}

// ============================================================================ 
// EJECUTAR PRUEBAS
// ============================================================================ 
async function main() {
  try {
    console.log('🚀 Iniciando pruebas del contrato Pocket...\n');
    console.log('📍 Contrato:', CONFIG.POCKET_CONTRACT_ID);
    console.log('🌐 Red:', CONFIG.NETWORK_PASSPHRASE);
    console.log('🔗 RPC:', CONFIG.RPC_URL);
    
    // Prueba 1: Obtener balance (solo simulación)
    //await testGetBalance('user_test_123');

    const testAccount = Keypair.random() // Generates a random accoutn
    await server.requestAirdrop(testAccount.publicKey()) // Funds te random account with 10000 XLM
    console.log(testAccount.publicKey())

    const createParams: xdr.ScVal[] = [
      new Address(testAccount.publicKey()).toScVal(),
      new Address("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC").toScVal(),
      nativeToScVal("10000000000", {type: "i128"})
    ]

    const result = await invokeContract(CONFIG.POCKET_CONTRACT_ID, "create_pocket", createParams, testAccount, false)
    console.log("Created Pocket", result)

    const depositParams: xdr.ScVal[] = [
      nativeToScVal(result, {type: "i128"}),
      new Address(testAccount.publicKey()).toScVal(),
      nativeToScVal("100000000", {type: "i128"})
    ]

    const resultDeposit = await invokeContract(CONFIG.POCKET_CONTRACT_ID, "deposit", depositParams, testAccount, false)
    console.log("resultDeposit", resultDeposit)


    
    // Prueba 2: Agregar fondos (ejecutar realmente)
    // await testAddFunds('user_test_123', 100);
    
    console.log('\n✅ Todas las pruebas completadas');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Error en las pruebas:', error);
    process.exit(1);
  }
}

// Ejecutar
main();
