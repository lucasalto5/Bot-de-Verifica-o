
const ADMIN_PANEL_ROLE_ID = '1256991306232889498'; // ID do cargo do painel administrativo


const { Client, GatewayIntentBits, Partials, MessageEmbed, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

//////////// Imagem do manual e linha 414  /////////////////
/////////// imagem do automatico e linha 196 ////////////////

// Arquivos de configuração
const configPath = path.resolve(__dirname, 'config.json');
const bannedPath = path.resolve(__dirname, 'banned.json');


function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(data);
        }
    } catch(err) {
        console.error('Erro ao carregar config:', err);
    }
    return {
        logsEnabled: false,
        logsChannelId: "",
        verificationMode: "manual", 
        verificationChannel: "" 
    };
}


function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
    } catch(err) {
        console.error('Erro ao salvar config:', err);
    }
}


function loadBanned() {
    try {
        if (fs.existsSync(bannedPath)) {
            const data = fs.readFileSync(bannedPath, 'utf-8');
            return new Set(JSON.parse(data));
        }
    } catch (err) {
        console.error('Erro ao carregar banidos:', err);
    }
    return new Set();
}


function saveBanned(bannedSet) {
    try {
        fs.writeFileSync(bannedPath, JSON.stringify(Array.from(bannedSet), null, 4));
    } catch (err) {
        console.error('Erro ao salvar banidos:', err);
    }
}


let config = loadConfig();
let bannedUsers = loadBanned();

// CONFIGURAÇÕES DO SISTEMA DE VERIFICAÇÃO
const VERIFIED_ROLE_ID = '1353506840830410803'; // Substitua pelo ID real do cargo.
const BLOCK_TIME = 5 * 60 * 1000; // 5 minutos


const verificationData = new Map();


function generateRandomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


function createVerificationSelect(correctCode) {
    const options = [];

    const correctOption = {
        label: correctCode,
        description: 'Selecione este código se for o correto.',
        value: correctCode
    };
    options.push(correctOption);

    while (options.length < 4) {
        let randomOption = generateRandomCode();
        if(randomOption === correctCode || options.some(opt => opt.value === randomOption)) continue;
        options.push({
            label: randomOption,
            description: 'Selecione este código se for o correto.',
            value: randomOption
        });
    }

    options.sort(() => Math.random() - 0.5);
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('verify_select')
        .setPlaceholder('Selecione o código correto')
        .addOptions(options);
    
    return new ActionRowBuilder().addComponents(selectMenu);
}


let adminPainelMessage = null;


async function updateAdminPainelEmbed(channel) {
    if(!channel) return;
    const painelEmbed = new EmbedBuilder()
        .setTitle('Painel Administrativo de Verificação')
        .setDescription(`Configurações atuais:
• Logs: **${config.logsEnabled ? 'Ativados' : 'Desativados'}**
• Canal de Logs: **${config.logsChannelId ? config.logsChannelId : 'Não definido'}**
• Modo de Verificação: **${config.verificationMode === 'manual' ? 'Manual (com código)' : 'Automático (instantâneo)'}**
• ${config.verificationMode === 'automatic' ? 'Canal de Verificação: **' + (config.verificationChannel ? config.verificationChannel : 'Não definido') + '**' : ''}
• Usuários Banidos: **${bannedUsers.size}**`)
        .setColor(0xFFA500);
    
    try {
        if(adminPainelMessage) {
            await adminPainelMessage.edit({ embeds: [painelEmbed] });
        } else {
            adminPainelMessage = await channel.send({ embeds: [painelEmbed] });
        }
    } catch (err) {
        console.error('Erro ao atualizar o painel administrativo:', err);
    }
}

client.on('ready', () => {
    console.log(`Logado como ${client.user.tag}`);
});


client.on('messageCreate', async (message) => {
    if(message.author.bot) return;
    

    if(bannedUsers.has(message.author.id)) {
        await message.reply({ content: 'Você está banido de realizar verificações.' });
        return;
    }
    
    // Comando !verificacao
    if(message.content === '!verificacao') {
        if(config.verificationMode === 'manual' && !message.member.roles.cache.has(ADMIN_PANEL_ROLE_ID)) {
            await message.reply({ content: 'Você não tem permissão para usar o comando !verificacao neste modo.' });
            return;
        }
        try {
            await message.delete();
        } catch (err) {
            console.error('Erro ao apagar mensagem:', err);
        }
        
        if(config.verificationMode === 'automatic') {
            const guild = message.guild;
            if(guild) {
                try {
                    const member = guild.members.cache.get(message.author.id) || await guild.members.fetch(message.author.id);
                    await member.roles.add(VERIFIED_ROLE_ID);
                    if(config.logsEnabled && config.logsChannelId) {
                        const logChannel = guild.channels.cache.get(config.logsChannelId);
                        if(logChannel) {
                            logChannel.send(`Usuário ${message.author.tag} verificado automaticamente.`);
                        }
                    }
                } catch (err) {
                    console.error('Erro ao atribuir cargo (modo automático):', err);
                    await message.channel.send({ content: 'Houve um erro ao atribuir o cargo. Contate um administrador.' });
                }
            }
            return;
        }
        

        const embed = new EmbedBuilder()
            .setTitle('Verificação')
            .setDescription('Clique no botão abaixo para iniciar sua verificação.')
            .setFields(
                { name: 'Instruções', value: '1. Clique no botão "Verificar". \n2. Selecione o código de verificação no campo abaixo.' }
            )
            .setImage('https://cdn.discordapp.com/attachments/1350704121627410462/1352838934006071296/6_Sem_Titulo_20241208183806.png?ex=67e17330&is=67e021b0&hm=f65eee586747cf3ae376734a9ec072a7faa58dcd466073de62f77986a12cb508&')
            .setColor(0x00AE86);
        
        const verifyButton = new ButtonBuilder()
            .setCustomId('verify_button')
            .setLabel('Verificar')
            .setEmoji('1353554498903081010')
            .setStyle(ButtonStyle.Success);
        
        const buttonRow = new ActionRowBuilder().addComponents(verifyButton);
        await message.channel.send({ embeds: [embed], components: [buttonRow] });
    }
    
    // Comando !vpainel
    if(message.content === '!vpainel') {
        if(!message.member.roles.cache.has(ADMIN_PANEL_ROLE_ID)) {
            await message.reply({ content: 'Você não tem permissão para acessar o painel administrativo.' });
            return;
        }
        
        const painelEmbed = new EmbedBuilder()
            .setTitle('Painel Administrativo de Verificação')
            .setDescription(`Configurações atuais:
• Logs: **${config.logsEnabled ? 'Ativados' : 'Desativados'}**
• Canal de Logs: **${config.logsChannelId ? config.logsChannelId : 'Não definido'}**
• Modo de Verificação: **${config.verificationMode === 'manual' ? 'Manual (com código)' : 'Automático (instantâneo)'}**
• ${config.verificationMode === 'automatic' ? 'Canal de Verificação: **' + (config.verificationChannel ? config.verificationChannel : 'Não definido') + '**' : ''}
• Usuários Banidos: **${bannedUsers.size}**`)
            .setColor(0xFFA500);
        
        const logsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('logs_activate')
                .setLabel('Ativar Logs')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('logs_deactivate')
                .setLabel('Desativar Logs')
                .setStyle(ButtonStyle.Danger)
        );
        
        const modeSelect = new StringSelectMenuBuilder()
            .setCustomId('mode_select')
            .setPlaceholder('Selecione o modo de verificação')
            .addOptions([
                {
                    label: 'Manual (com código)',
                    description: 'Usuário precisa selecionar o código correto.',
                    value: 'manual'
                },
                {
                    label: 'Automático (instantâneo)',
                    description: 'Cargo é atribuído imediatamente.',
                    value: 'automatic'
                }
            ]);
        const modeRow = new ActionRowBuilder().addComponents(modeSelect);
        
        const banRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ban_user_button')
                .setLabel('Banir Usuário')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('unban_user_button')
                .setLabel('Desbanir Usuário')
                .setStyle(ButtonStyle.Primary)
        );
        
        adminPainelMessage = await message.channel.send({ embeds: [painelEmbed], components: [logsRow, modeRow, banRow] });
    }
});


client.on('interactionCreate', async (interaction) => {

    if(interaction.user && bannedUsers.has(interaction.user.id) && interaction.customId === 'verify_button') {
        await interaction.reply({ content: 'Você está banido de realizar verificações.', ephemeral: true });
        return;
    }
    

    if(interaction.isButton() && interaction.customId === 'verify_button') {
        const randomCode = generateRandomCode();
        verificationData.set(interaction.user.id, { correctCode: randomCode, attempts: 0, blockUntil: 0 });
        
        const embed = new EmbedBuilder()
            .setTitle('Instruções de Verificação')
            .setDescription(`Observe o código abaixo e selecione a opção correta no menu.\n\nCódigo: ||${randomCode}||`)
            .setColor(0x00AE86);
        const selectRow = createVerificationSelect(randomCode);
        await interaction.reply({ embeds: [embed], components: [selectRow], ephemeral: true });
    }
    

    if(interaction.isStringSelectMenu() && interaction.customId === 'verify_select') {
        const userData = verificationData.get(interaction.user.id);
        const currentTime = Date.now();
        
        if(!userData) {
            await interaction.reply({ content: 'Inicie novamente a verificação clicando no botão "Verificar".', ephemeral: true });
            return;
        }
        if(userData.blockUntil && currentTime < userData.blockUntil) {
            const remaining = Math.ceil((userData.blockUntil - currentTime) / 1000);
            await interaction.reply({ content: `Você errou duas vezes. Tente novamente em ${remaining} segundos.`, ephemeral: true });
            return;
        }
        
        const selectedCode = interaction.values[0];
        if(selectedCode === userData.correctCode) {
            const guild = interaction.guild;
            if (!guild) {
                await interaction.reply({ content: 'Erro: Este comando só pode ser utilizado em servidores.', ephemeral: true });
                return;
            }
            const member = guild.members.cache.get(interaction.user.id) || await guild.members.fetch(interaction.user.id);
            try {
                await member.roles.add(VERIFIED_ROLE_ID);
                await interaction.reply({ content: 'Verificação bem-sucedida! Você recebeu o cargo.', ephemeral: true });
                if(config.logsEnabled && config.logsChannelId) {
                    const logChannel = guild.channels.cache.get(config.logsChannelId);
                    if(logChannel) logChannel.send(`Usuário ${interaction.user.tag} verificado com sucesso.`);
                }
            } catch (err) {
                console.error('Erro ao atribuir cargo:', err);
                await interaction.reply({ content: 'Erro ao atribuir cargo. Contate um administrador.', ephemeral: true });
            }
            verificationData.delete(interaction.user.id);
        } else {
            userData.attempts++;
            if(userData.attempts >= 2) {
                userData.blockUntil = currentTime + BLOCK_TIME;
                await interaction.reply({ content: 'Você errou duas vezes. Tente novamente em 5 minutos.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Código incorreto. Tente novamente.', ephemeral: true });
            }
            verificationData.set(interaction.user.id, userData);
        }
    }
    

    if(interaction.isButton() && (interaction.customId === 'logs_activate' || interaction.customId === 'logs_deactivate')) {
        if(!interaction.member.permissions.has("Administrator")) {
            await interaction.reply({ content: 'Você não tem permissão para esta ação.', ephemeral: true });
            return;
        }

        if(interaction.customId === 'logs_activate') {
            const modal = new ModalBuilder()
                .setCustomId('set_logs_channel')
                .setTitle('Ativar Logs - Configurar Canal');
            
            const logsChannelInput = new TextInputBuilder()
                .setCustomId('logsChannelId')
                .setLabel('Informe o ID do canal de logs:')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            
            const modalRow = new ActionRowBuilder().addComponents(logsChannelInput);
            modal.addComponents(modalRow);
            
            await interaction.showModal(modal);
        } else {

            config.logsEnabled = false;
            config.logsChannelId = "";
            saveConfig(config);
            await interaction.reply({ content: 'Logs desativados.', ephemeral: true });

            if(adminPainelMessage) updateAdminPainelEmbed(adminPainelMessage.channel);
        }
    }
    

    if(interaction.type === InteractionType.ModalSubmit && interaction.customId === 'set_logs_channel') {
        const channelId = interaction.fields.getTextInputValue('logsChannelId');
        config.logsEnabled = true;
        config.logsChannelId = channelId;
        saveConfig(config);
        await interaction.reply({ content: `Logs ativados. Canal definido: ${channelId}`, ephemeral: true });

        if(adminPainelMessage) updateAdminPainelEmbed(adminPainelMessage.channel);
    }
    

    if(interaction.isStringSelectMenu() && interaction.customId === 'mode_select') {
        if(!interaction.member.permissions.has("Administrator")) {
            await interaction.reply({ content: 'Você não tem permissão para esta ação.', ephemeral: true });
            return;
        }
        async function handleVerificationModeSelection(interaction, config, saveConfig) {
            const selectedMode = interaction.values[0];
            config.verificationMode = selectedMode; 
        
            if (selectedMode === 'automatic') {
                await interaction.reply({ content: 'Por favor, envie o ID do canal onde a verificação deve ocorrer.', ephemeral: true });
        
                const filter = response => response.author.id === interaction.user.id;
                const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 30000 });
        
                collector.on('collect', async response => {
                    const channelId = response.content.trim();
                    const channel = interaction.guild.channels.cache.get(channelId);
        
                    if (!channel) {
                        return interaction.followUp({ content: 'ID de canal inválido. Tente novamente.', ephemeral: true });
                    }
        
                    config.verificationChannel = channelId;
                    saveConfig(config);
        
                    const embed = new EmbedBuilder()
                        .setTitle('Verificação Necessária')
                        .setDescription('Use o comando `!verificacao` para verificar sua conta.') //embaixo troca a imagem se quiser tirar so retirar a linha interia
                        .setImage('https://cdn.discordapp.com/attachments/1350704121627410462/1352838934006071296/6_Sem_Titulo_20241208183806.png?ex=67e17330&is=67e021b0&hm=f65eee586747cf3ae376734a9ec072a7faa58dcd466073de62f77986a12cb508&') // imagem do embed manual aqui
                        .setColor('Blue');	
        
                    await channel.send({ embeds: [embed] });
                    await interaction.followUp({ content: `Modo de verificação atualizado para Automático. Mensagem de verificação enviada em <#${channelId}>.`, ephemeral: true });

                    if(adminPainelMessage) updateAdminPainelEmbed(adminPainelMessage.channel);
                });
            } else {
                saveConfig(config);
                await interaction.reply({ content: `Modo de verificação atualizado para Manual (com código).`, ephemeral: true });

                if(adminPainelMessage) updateAdminPainelEmbed(adminPainelMessage.channel);
            }
        }
        await handleVerificationModeSelection(interaction, config, saveConfig);
    } 
    

    if(interaction.isButton() && (interaction.customId === 'ban_user_button' || interaction.customId === 'unban_user_button')) {
        if(!interaction.member.permissions.has("Administrator")) {
            await interaction.reply({ content: 'Você não tem permissão para esta ação.', ephemeral: true });
            return;
        }
        let customId = '';
        let options = [];
        const guild = interaction.guild;
        if(!guild) return;
        
        if(interaction.customId === 'ban_user_button') {
            customId = 'ban_select';

            const members = Array.from(guild.members.cache.filter(m => !m.user.bot && !bannedUsers.has(m.id)).values()).slice(0, 10);
            options = members.map(member => ({
                label: member.user.tag.substring(0, 25),
                description: `ID: ${member.id}`,
                value: member.id
            }));
            if(options.length === 0) {
                await interaction.reply({ content: 'Nenhum membro elegível para banimento foi encontrado.', ephemeral: true });
                return;
            }
        }
        
        if(interaction.customId === 'unban_user_button') {
            customId = 'unban_select';
            options = Array.from(bannedUsers).map(userId => {
                const member = guild.members.cache.get(userId);
                return {
                    label: member ? member.user.tag.substring(0,25) : userId,
                    description: `ID: ${userId}`,
                    value: userId
                };
            });
            if(options.length === 0) {
                await interaction.reply({ content: 'Não há usuários banidos.', ephemeral: true });
                return;
            }
        }
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(interaction.customId === 'ban_user_button' ? 'Selecione o usuário a banir' : 'Selecione o usuário a desbanir')
            .addOptions(options);
        const menuRow = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.reply({ content: 'Faça sua seleção:', components: [menuRow], ephemeral: true });
    }
    

    if(interaction.isStringSelectMenu() && interaction.customId === 'ban_select') {
        if(!interaction.member.permissions.has("Administrator")) {
            await interaction.reply({ content: 'Você não tem permissão para esta ação.', ephemeral: true });
            return;
        }
        const userId = interaction.values[0];
        bannedUsers.add(userId);
        saveBanned(bannedUsers);

        const guild = interaction.guild;
        if(guild) {
            try {
                const member = guild.members.cache.get(userId) || await guild.members.fetch(userId);
                if(member.roles.cache.has(VERIFIED_ROLE_ID)) {
                    await member.roles.remove(VERIFIED_ROLE_ID);
                }
            } catch (err) {
                console.error('Erro ao remover cargo do usuário banido:', err);
            }
        }
        await interaction.reply({ content: `Usuário com ID ${userId} foi banido da verificação.`, ephemeral: true });

        if(adminPainelMessage) updateAdminPainelEmbed(adminPainelMessage.channel);
    }
    

    if(interaction.isStringSelectMenu() && interaction.customId === 'unban_select') {
        if(!interaction.member.permissions.has("Administrator")) {
            await interaction.reply({ content: 'Você não tem permissão para esta ação.', ephemeral: true });
            return;
        }
        const userId = interaction.values[0];
        bannedUsers.delete(userId);
        saveBanned(bannedUsers);
        await interaction.reply({ content: `Usuário com ID ${userId} foi desbanido da verificação.`, ephemeral: true });

        if(adminPainelMessage) updateAdminPainelEmbed(adminPainelMessage.channel);
    }
});

client.login(''); // TOKEN DO BOT DISCORD COLOCA NO LUGAR ONDE TA ESCRITO SEU TOKEN