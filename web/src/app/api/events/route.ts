export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export async function PUT(req: Request) {
  type UpdateEventBody = {
    id: string
    title: string
  description?: string
  observation?: string
    date: string
    type: EventType
    startTime: string
    endTime: string
    professionalId: string
    files?: any
    notificationId?: string
  }
  let body: UpdateEventBody | undefined = undefined
  try {
    body = await req.json()
    const {
      id,
      title,
      description,
      date,
      type,
      startTime,
      endTime,
      professionalId,
      files,
      notificationId,
    } = body as UpdateEventBody
    if (
      !id ||
      !title ||
      !date ||
      !type ||
      !startTime ||
      !endTime ||
      !professionalId
    ) {
      console.warn(
        `[API Events] Campos obrigatórios ausentes para atualização:`,
        {
          id,
          title,
          date,
          type,
          startTime,
          endTime,
          professionalId,
        }
      )
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 }
      )
    }

    // Validar data e horários
    const validation = validateEventDateTime(date, startTime, endTime)
    if (!validation.isValid) {
      const errorMessages = Object.values(validation.errors).join(' ')
      console.warn(
        `[API Events] Validação falhou na atualização:`,
        validation.errors
      )
      return NextResponse.json(
        { error: errorMessages || 'Dados inválidos' },
        { status: 400 }
      )
    }

    // Converter data para UTC (assumindo que a data recebida é local)
    const localDate = new Date(`${date}T12:00:00`) // Meio dia para evitar problemas de timezone
    const utcDate = localDate.toISOString().split('T')[0] // YYYY-MM-DD em UTC

    // Se notificationId for fornecido, atualizar evento e arquivar notificação em transação
    if (notificationId) {
      const overwrite = req.headers.get('x-overwrite-result') === 'true';
      const result = await prisma.$transaction(async (tx) => {
        // Buscar evento existente
        const existing = await tx.healthEvent.findUnique({ where: { id } })
        if (!existing) {
          throw new Error('Evento não encontrado')
        }
        // Verificar se já existe laudo no slot result
        const filesArr = Array.isArray(files) ? files : [];
        const alreadyHasResult = Array.isArray(existing.files)
          ? existing.files.some((f: any) => f.slot === 'result')
          : false;
        if (alreadyHasResult && !overwrite) {
          return { conflict: true, message: 'Já existe um laudo para este evento. Deseja sobrescrever?' };
        }
        // Permitir sobrescrever: remove o antigo e adiciona o novo
        let mergedFiles = Array.isArray(existing.files) ? existing.files.filter((f: any) => f.slot !== 'result') : [];
        for (const f of filesArr) {
          mergedFiles = mergedFiles.filter((file: any) => file.slot !== f.slot);
          mergedFiles.push(f);
        }
        // Atualizar evento
        const event = await tx.healthEvent.update({
          where: { id },
          data: {
            title,
            description,
            date: utcDate,
            startTime,
            endTime,
            type,
            professionalId,
            files: mergedFiles,
          },
        });
        await tx.notification.update({
          where: { id: notificationId },
          data: { status: 'ARCHIVED' },
        });
        return event;
      });
      if (result && (result as any).conflict) {
        return NextResponse.json({ warning: (result as any).message }, { status: 409 });
      }
      if ((result as any)?.id) {
        console.log(`[API Events] Evento atualizado e notificação arquivada: ${(result as any).id}`)
      }
      return NextResponse.json(result, { status: 200 })
    } else {
      const event = await prisma.healthEvent.update({
        where: { id },
        data: {
          title,
          description,
          date: utcDate,
          startTime,
          endTime,
          type,
          professionalId,
          files: files || [],
        },
      })
      console.log(`[API Events] Evento atualizado com sucesso: ${event.id}`)
      return NextResponse.json(event, { status: 200 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[API Events] Erro ao atualizar evento:`, {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestData: body || null,
    })
    return NextResponse.json(
      {
        error: 'Erro interno do servidor ao atualizar evento',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}
import { NextResponse } from 'next/server'
import { EventType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  validateDate,
  validateStartTime,
  validateEndTime,
  validateEventDateTime,
} from '@/lib/validators/eventValidators'
import fs from 'fs'
import path from 'path'

const DEFAULT_USER_EMAIL = 'user@email.com'


// Função utilitária para obter userId do query param
function getUserIdFromUrl(req: Request): string | null {
  try {
    // Se req.url não for absoluta, adiciona um base
    const url = req.url.startsWith('http') ? new URL(req.url) : new URL(req.url, 'http://localhost')
    const userId = url.searchParams.get('userId')
    return userId || null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  try {
    const userId = getUserIdFromUrl(req)
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
    }
    console.log(`[API Events] Buscando eventos para usuário: ${userId}`)
    const events = await prisma.healthEvent.findMany({
      where: { userId },
    })
    console.log(`[API Events] Encontrados ${events.length} eventos`)
    return NextResponse.json(events, {
      headers: {
        // Evita cache no edge/CDN e no browser, garantindo atualização imediata.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[API Events] Erro ao buscar eventos:`, {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    })
    return NextResponse.json(
      {
        error: 'Erro interno do servidor ao buscar eventos',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  type EventBody = {
    title: string
    description?: string
    observation?: string
    date: string
    type: EventType
    startTime: string
    endTime: string
    professionalId: string
    files?: any
    notificationId?: string
  }
  let body: EventBody | undefined = undefined
  try {
    body = await req.json()
    const userId = getUserIdFromUrl(req)
    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
    }
    const {
      title,
      description,
      observation,
      date,
      type,
      startTime,
      endTime,
      professionalId,
      files,
      notificationId,
    } = body as EventBody
    console.log(`[API Events] Criando evento para usuário: ${userId}`, {
      title,
      date,
      type,
      notificationId,
    })
    if (!title || !date || !type || !startTime || !endTime || !professionalId) {
      console.warn(`[API Events] Campos obrigatórios ausentes:`, {
        title,
        date,
        type,
        startTime,
        endTime,
        professionalId,
      })
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 }
      )
    }

    // Validar data e horários
    const validation = validateEventDateTime(date, startTime, endTime)
    if (!validation.isValid) {
      const errorMessages = Object.values(validation.errors).join(' ')
      console.warn(`[API Events] Validação falhou:`, validation.errors)
      return NextResponse.json(
        { error: errorMessages || 'Dados inválidos' },
        { status: 400 }
      )
    }

    // Converter data para UTC (assumindo que a data recebida é local)
    const localDate = new Date(`${date}T12:00:00`) // Meio dia para evitar problemas de timezone
    const utcDate = localDate.toISOString().split('T')[0] // YYYY-MM-DD em UTC

    // Verificar sobreposição de eventos para o mesmo profissional, data e horário
    const overlappingEvents = await prisma.healthEvent.findMany({
      where: {
        professionalId,
        date: utcDate,
        AND: [
          {
            startTime: { lte: endTime },
          },
          {
            endTime: { gte: startTime },
          },
        ],
      },
    })
    if (overlappingEvents.length > 0) {
      return NextResponse.json(
        { error: 'Já existe um evento para este profissional neste horário (sobreposição).' },
        { status: 400 }
      )
    }

    // Se notificationId for fornecido, criar evento e arquivar notificação em transação
    if (notificationId) {
      // Se não houver observation, usar mensagem padrão na description
      const desc = observation?.trim()
        ? observation
        : 'Laudo enviado pelo app Omni';
      const result = await prisma.$transaction(async (tx) => {
        const event = await tx.healthEvent.create({
          data: {
            title,
            description: desc,
            observation,
            date: utcDate,
            startTime,
            endTime,
            type,
            userId,
            professionalId,
            files: files || [],
          },
        })
        await tx.notification.update({
          where: { id: notificationId },
          data: { status: 'ARCHIVED' },
        })
        return event
      })
      console.log(`[API Events] Evento criado e notificação arquivada: ${result.id}`)
      return NextResponse.json(result, { status: 201 })
    } else {
      const event = await prisma.healthEvent.create({
        data: {
          title,
          description,
          observation,
          date: utcDate,
          startTime,
          endTime,
          type,
          userId,
          professionalId,
          files: files || [],
        },
      })
      console.log(`[API Events] Evento criado com sucesso: ${event.id}`)
      return NextResponse.json(event, { status: 201 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[API Events] Erro ao criar evento:`, {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestData: body || null,
    })
    return NextResponse.json(
      {
        error: 'Erro interno do servidor ao criar evento',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  type DeleteBody = { id: string; deleteFiles?: boolean }
  let body: DeleteBody | undefined = undefined
  try {
    body = await req.json()
    const { id, deleteFiles = false } = body as DeleteBody
    console.log(
      `[API Events] Deletando evento: ${id}, deleteFiles: ${deleteFiles}`
    )

    if (!id) {
      console.warn(`[API Events] ID do evento não fornecido`)
      return NextResponse.json(
        { error: 'ID do evento é obrigatório' },
        { status: 400 }
      )
    }

    // Buscar o evento para obter os arquivos antes de deletar
    const event = await prisma.healthEvent.findUnique({
      where: { id },
      select: { files: true },
    })

    if (!event) {
      console.warn(`[API Events] Evento não encontrado: ${id}`)
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    // Se deleteFiles for true, deletar arquivos associados
    if (deleteFiles && event.files && Array.isArray(event.files)) {
      for (const file of event.files as any[]) {
        if (file && typeof file === 'object' && 'url' in file && file.url) {
          try {
            // Extrair o caminho relativo do arquivo da URL (aceita relativa)
            const rawUrl = String(file.url)
            const url = rawUrl.startsWith('http')
              ? new URL(rawUrl)
              : new URL(rawUrl, 'http://localhost')
            const filePath = url.pathname.replace(
              '/uploads/',
              'public/uploads/'
            )
            const fullPath = path.join(process.cwd(), filePath)

            // Deletar arquivo do sistema de arquivos
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath)
              console.log(`[API Events] Arquivo deletado: ${fullPath}`)
            } else {
              console.warn(`[API Events] Arquivo não encontrado: ${fullPath}`)
            }
          } catch (fileError) {
            console.error(
              `[API Events] Erro ao deletar arquivo ${file.url}:`,
              fileError
            )
            // Não falhar a operação se não conseguir deletar um arquivo
          }
        }
      }
    }

    // Deletar o evento
    await prisma.healthEvent.delete({
      where: { id },
    })
    console.log(`[API Events] Evento deletado com sucesso: ${id}`)
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[API Events] Erro ao deletar evento:`, {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      requestData: body,
    })
    return NextResponse.json(
      {
        error: 'Erro interno do servidor ao deletar evento',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}
