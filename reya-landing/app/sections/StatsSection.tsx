'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Calendar, Users, Building2, Award } from 'lucide-react'

const stats = [
  { icon: Calendar, number: '13+', label: 'ปีประสบการณ์', desc: 'ที่ไว้วางใจได้' },
  { icon: Users, number: '10,000+', label: 'ลูกค้า', desc: 'ผิวสวยจริงไม่จกตา' },
  { icon: Building2, number: '50+', label: 'แบรนด์', desc: 'ไว้ใจให้ผลิต OEM' },
  { icon: Award, number: 'GMP', label: 'มาตรฐาน', desc: 'โรงงานรับรองคุณภาพ' },
]

export default function StatsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="stats" className="py-16 bg-cream" ref={ref}>
      <div className="section-padding max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center p-6"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-4">
                <stat.icon size={28} />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">
                {stat.number}
              </div>
              <div className="text-lg font-medium text-dark mb-1">
                {stat.label}
              </div>
              <div className="text-sm text-muted">
                {stat.desc}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
