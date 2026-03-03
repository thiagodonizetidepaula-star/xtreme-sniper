instrument {
    name = 'Indicador Xtreme Sniper',
    short_name = 'Xtreme Sniper',
    overlay = true
}

MaFast_period = input(1,"Ma Fast period",input.integer,1,1000,1)
MaValue = input(5,"Ma Value", input.string_selection,inputs.titles)
MaSlow_period = input(34,"Ma Slow period",input.integer,1,1000,1)
Signal_period = input(5,"Signal period",input.integer,1,1000,1)

input_group {
    "Compra",
    colorBuy = input { default = "green", type = input.color }, 
    visibleBuy = input { default = true, type = input.plot_visibility }
}
input_group {
    "Venda",
    colorSell = input { default = "red", type = input.color },
    visibleSell = input { default = true, type = input.plot_visibility }
}

local titleValue = inputs[MaValue]
smaFast = sma(titleValue, MaFast_period)
smaSlow = sma(titleValue, MaSlow_period)
buffer1 = smaFast - smaSlow
buffer2 = wma(buffer1, Signal_period)
buyCondition = conditional(buffer1 > buffer2 and buffer1[1] < buffer2[1])
sellCondition = conditional(buffer1 < buffer2 and buffer1[1] > buffer2[1])

plot_shape(buyCondition,"COMPRA XTREME SNIPER",shape_style.triangleup,shape_size.huge,colorBuy,shape_location.belowbar,-1,"COMPRA XTREME SNIPER","green")
plot_shape(sellCondition,"VENDA XTREME SNIPER",shape_style.triangledown,shape_size.huge,colorSell,shape_location.abovebar,-1,"VENDA XTREME SNIPER","red")