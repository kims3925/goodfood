import { Metadata } from 'next'
import prisma from '@bandauto/db'
import ProductDetailClient from './ProductDetailClient'

type Props = {
  params: { id: string }
}

async function getProduct(id: string) {
  try {
    const productId = parseInt(id)
    if (isNaN(productId)) return null

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          orderBy: { id: 'asc' },
          take: 1,
        },
        collectedProduct: {
          include: {
            post: {
              include: {
                images: {
                  where: { sortOrder: 0 },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })

    return product
  } catch (error) {
    console.error('Failed to fetch product for metadata:', error)
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.id)

  if (!product) {
    return {
      title: '상품을 찾을 수 없습니다',
    }
  }

  const title = product.name
  const description = product.description || `${product.name} - 최저가로 만나보세요`
  const price = product.variants[0]?.price

  // sort_order가 0인 이미지 (대표 이미지)
  const mainImage =
    product.collectedProduct?.post?.images?.[0]?.url ||
    product.thumbnailUrl ||
    '/images/placeholder.png'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: mainImage,
          width: 800,
          height: 800,
          alt: title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [mainImage],
    },
  }
}

export default function ProductDetailPage() {
  return <ProductDetailClient />
}
