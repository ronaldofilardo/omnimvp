import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import EventDetail from '@/components/EventDetail'

// Função para buscar dados no servidor (SSR)
async function getEvent(id: string) {
  try {
    const event = await prisma.healthEvent.findUnique({
      where: { id },
      include: {
        professional: true,
      },
    })

    if (!event) {
      return null
    }

    // Garante que observation nunca será null, apenas string ou undefined
    return {
      ...event,
      observation: event.observation ?? undefined,
    }
  } catch (error) {
    console.error('Erro ao buscar evento:', error)
    return null
  }
}

// Metadados dinâmicos
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const event = await getEvent(params.id)

  if (!event) {
    return {
      title: 'Evento não encontrado',
    }
  }

  return {
    title: `${event.title} - Omni Saúde`,
    description: event.description || `Detalhes do evento ${event.title}`,
  }
}

// Página com SSR
export default async function EventPage({ params }: { params: { id: string } }) {
  const event = await getEvent(params.id)

  if (!event) {
    notFound()
  }

  return <EventDetail event={event} />
}

// Configuração de revalidação (ISR)
export const revalidate = 60 // Revalidar a cada 60 segundos