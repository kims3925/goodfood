import prisma from '@bandauto/db'

async function fix() {
  const result = await prisma.productVariant.update({
    where: { id: 90 },
    data: { bundleUnit: 1 }
  })
  console.log('Updated variant:', result.id, '- bundleUnit =', result.bundleUnit)
  await prisma.$disconnect()
}

fix().catch(console.error)
