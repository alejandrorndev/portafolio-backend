// Viola la regla a proposito: el dominio no depende del framework.
// `src/architecture.spec.ts` comprueba que ESLint lo siga rechazando.
import { Injectable } from '@nestjs/common'

export const violacion = Injectable
