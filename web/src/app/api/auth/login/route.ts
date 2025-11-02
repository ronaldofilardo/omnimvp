import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    console.log('Tentando login para:', email)

    if (!email || !password) {
      console.log('Faltando email ou senha')
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    console.log('Email normalizado:', normalizedEmail)

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      include: { emissorInfo: true },
    })

    if (!user) {
      console.log('Usuário não encontrado')
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    console.log('Usuário encontrado:', user.email, 'Role:', user.role)
    console.log('Hash no banco:', user.password)

    const isPasswordValid = await bcrypt.compare(password, user.password)
    console.log('Senha válida?', isPasswordValid)

    if (!isPasswordValid) {
      console.log('Senha inválida')
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    const allowedRoles = ['RECEPTOR', 'EMISSOR'] as const
    if (!allowedRoles.includes(user.role as any)) {
      console.log('Role não permitido:', user.role)
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }

    // Retornar usuário sem senha
    const { password: _, ...userWithoutPassword } = user

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
