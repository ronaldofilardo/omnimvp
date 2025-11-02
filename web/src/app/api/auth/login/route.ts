import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Normalizar e-mail para evitar problemas de caixa/espaços
    const normalizedEmail = String(email).trim().toLowerCase()

    // Buscar usuário pelo email (case-insensitive) e incluir dados adicionais
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      include: {
        emissorInfo: true, // Incluir informações do emissor, se houver
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

  // Verificar senha
  const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

  // Retornar usuário sem senha
  const { password: _, ...userWithoutPassword } = user

  // Permitir login tanto para RECEPTOR quanto para EMISSOR
  const allowedRoles = ['RECEPTOR', 'EMISSOR'] as const
  if (!allowedRoles.includes(user.role as any)) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  // Setar cookie de sessão com o id e role do usuário (ex: id:role)
  const sessionValue = `${user.id}:${user.role}`
  const response = NextResponse.json({ user: userWithoutPassword }, { status: 200 })
  response.headers.set(
    'Set-Cookie',
    `kairos_imob_session=${sessionValue}; Path=/; HttpOnly; SameSite=Lax`
  )
  return response
  } catch (error) {
    console.error('Erro ao fazer login:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
